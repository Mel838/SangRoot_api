# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev          # Watch mode (uses --max-old-space-size=4096)
npm run start:debug        # Debug + watch mode

# Build & Production
npm run build              # Compile TypeScript via NestJS CLI
npm run start:prod         # Run compiled output from dist/

# Standalone agent server (outside NestJS)
npm run start:agent        # ts-node src/services/agents/index.ts

# Code quality
npm run lint               # ESLint with auto-fix
npm run format             # Prettier on src/ and test/

# Tests
npm run test               # All unit tests (jest, rootDir: src/, *.spec.ts)
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # E2E tests (test/jest-e2e.json)

# Database
npx prisma migrate dev     # Apply and generate migrations
npx prisma generate        # Regenerate Prisma client (also runs on postinstall)
npx prisma db seed         # Seed using prisma/seed.ts
```

## Architecture Overview

**SangRoot** is a blood donation coordination platform for Cameroon. The backend is a NestJS API backed by PostgreSQL (via Prisma), with an embedded AI agent system (VoltAgent) that autonomously contacts donors and blood banks over WhatsApp.

### Two-port architecture

The NestJS server runs on `PORT` (default 3000) and the VoltAgent server runs on `VOLT_PORT` (default 3141). Both start from the same `npm run start:dev` process — `VoltAgentModule` bootstraps the VoltAgent Hono server inside NestJS on application bootstrap.

### User roles & domain entities

`UserRole` has three values: `HOSPITAL`, `BLOOD_BANK`, `DOCTOR`.

- **Hospitals** register, invite doctors, and submit blood requests.
- **Blood Banks** register donors and respond to outreach.
- **Doctors** are invited via `HospitalInvite` (accept-invite flow) and can create blood requests.
- **Donors** are not platform users — they interact only via WhatsApp.

### AI Agent system (`src/services/agents/`)

There are two top-level coordinator agents, both registered as NestJS providers in `VoltAgentModule`:

| Token | Agent | Triggered by |
|---|---|---|
| `DOCTOR_COORDINATOR_TOKEN` | `doctor-coordinator` (GPT-4o) | `BloodRequestsService` — when a doctor creates a blood request |
| `DONOR_COORDINATOR_TOKEN` | `donor-coordinator` (GPT-4o-mini) | `WhatsappService` — on every inbound WhatsApp message |

Each coordinator has sub-agents:

- **doctor-coordinator** sub-agents: `triage`, `bridge`, `progress-monitor`, `eligibility-report`, `escalation`
- **donor-coordinator** sub-agents: `onboarding`, `donor-outreach`, `blood-bank-outreach`, `conversation`, `follow-up`, `eligibility-checker`, `profile-updater`

All agents share a `PostgreSQLMemoryAdapter` using the `sangroot_agent_memory` table prefix.

Agent tool calls hit the NestJS API at `INTERNAL_API_URL` using the `AGENT_API_KEY` header (`x-agent-key`), routed through `InternalAgentsController` (`/internal/agents/*`), protected by `AgentKeyGuard`. These endpoints are never called by frontend clients.

### WhatsApp flow

Inbound messages arrive at `WhatsappController` → `WhatsappService.processWebhook()`. The service resolves the sender via `PhoneNumberRegistry` (with a fallback direct lookup in `Donor`/`BloodBank`), stores the message in the conversation thread via the internal API, then fires the donor coordinator agent asynchronously (fire-and-forget so the webhook responds immediately).

Outbound messages are sent via `WhatsappCloudService` (Meta Cloud API) or `KapsoService`, depending on configuration.

### Authentication

JWT-based (`passport-jwt`). Access tokens are short-lived; refresh tokens are stored hashed in the `RefreshToken` table and rotated on each use. Google OAuth is supported via `google-auth-library`. The `@CurrentUser()` decorator and `JwtAuthGuard` + `RolesGuard` are used across protected routes.

### Key environment variables

See `.env.example`. Critical ones:

- `DATABASE_URL` — PostgreSQL connection string (also used by VoltAgent memory)
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `AGENT_API_KEY` — shared secret between VoltAgent tools and `InternalAgentsController`
- `INTERNAL_API_URL` — base URL agents use to call back into NestJS (default: `http://localhost:3000`)
- `VOLT_PORT` — VoltAgent Hono server port (default: 3141)
- `WHATSAPP_CLOUD_API_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, `WHATSAPP_CLOUD_VERIFY_TOKEN`

### Prisma

Schema is at `prisma/schema.prisma`. Key enums: `BloodGroup`, `CameroonRegion`, `RequestStatus`, `RequestUrgency`, `DonorConversationState`, `BloodBankConversationState`, `OutreachTaskStatus`. The `NODE_OPTIONS=--max-old-space-size=4096` flag in start scripts is intentional — the agent system is memory-intensive.

### Standalone agent entry point

`src/services/agents/index.ts` is a standalone VoltAgent server that only includes the original `sangroot-coordinator` agent (older). The production path uses `VoltAgentModule` inside NestJS, which registers both `doctor-coordinator` and `donor-coordinator`.
