import { Agent, Memory } from '@voltagent/core';
import { PostgreSQLMemoryAdapter } from '@voltagent/postgres';
import {
  getCoordinatorAgentInstructions,
  getDonorOutreachAgentInstructions,
  getBloodBankLiaisonAgentInstructions,
  getEligibilityTimingAgentInstructions,
  getResultReportingAgentInstructions,
} from './prompts';
import {
  donorOutreachAgentTools,
  bloodBankLiaisonAgentTools,
  eligibilityTimingAgentTools,
  resultReportingAgentTools,
} from './tools';

const sharedMemory = new Memory({
  storage: new PostgreSQLMemoryAdapter({
    connection: {
      host: process.env.DB_HOST!,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      user: process.env.DB_USERNAME!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_NAME!,
      ssl: {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
      },
    },
    tablePrefix: 'sangroot_agent_memory',
  }),
});

// ---------------------------------------------------------------------------
// Sub-Agent: Donor Outreach
// Contacts registered donors via WhatsApp/SMS, records their responses.
// ---------------------------------------------------------------------------
const donorOutreachAgent = new Agent({
  name: 'donor-outreach-agent',
  instructions: getDonorOutreachAgentInstructions,
  model: 'openai/gpt-4o-mini',
  tools: donorOutreachAgentTools,
  memory: sharedMemory,
  maxSteps: 20,
});

// ---------------------------------------------------------------------------
// Sub-Agent: Blood Bank Liaison
// Notifies nearby blood banks, collects availability feedback.
// ---------------------------------------------------------------------------
const bloodBankLiaisonAgent = new Agent({
  name: 'blood-bank-liaison-agent',
  instructions: getBloodBankLiaisonAgentInstructions,
  model: 'openai/gpt-4o-mini',
  tools: bloodBankLiaisonAgentTools,
  memory: sharedMemory,
  maxSteps: 20,
});

// ---------------------------------------------------------------------------
// Sub-Agent: Eligibility & Timing
// Filters responses by donation intervals, location, and timing constraints.
// Pure reasoning — no external tools needed.
// ---------------------------------------------------------------------------
const eligibilityTimingAgent = new Agent({
  name: 'eligibility-timing-agent',
  instructions: getEligibilityTimingAgentInstructions,
  model: 'openai/gpt-4o-mini',
  tools: eligibilityTimingAgentTools,
  memory: sharedMemory,
  maxSteps: 20,
});

// ---------------------------------------------------------------------------
// Sub-Agent: Result Reporting
// Aggregates outcomes and produces calm, structured summaries for doctors.
// ---------------------------------------------------------------------------
const resultReportingAgent = new Agent({
  name: 'result-reporting-agent',
  instructions: getResultReportingAgentInstructions,
  model: 'openai/gpt-4o-mini',
  tools: resultReportingAgentTools,
  memory: sharedMemory,
  maxSteps: 20,
});

// ---------------------------------------------------------------------------
// Coordinator Agent (Master Orchestrator)
// Routes and delegates to sub-agents. Never contacts donors or the backend directly.
// ---------------------------------------------------------------------------
export const agent = new Agent({
  name: 'sangroot-coordinator',
  instructions: getCoordinatorAgentInstructions,
  model: 'openai/gpt-4o-mini',
  memory: sharedMemory,
  maxSteps: 30,
  subAgents: [
    donorOutreachAgent,
    bloodBankLiaisonAgent,
    eligibilityTimingAgent,
    resultReportingAgent,
  ],
});
