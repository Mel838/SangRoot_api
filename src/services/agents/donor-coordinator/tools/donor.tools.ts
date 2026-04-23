import { createTool } from '@voltagent/core';
import { z } from 'zod';
import { Logger } from '@nestjs/common';
import { Pool } from 'pg';

const logger = new Logger('DonorTools');

const API_URL = () => process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
const API_KEY = () => process.env.AGENT_API_KEY ?? '';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-agent-key': API_KEY(),
});

interface WhatsAppResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string };
}

async function sendWhatsAppMessage(options: { to: string; body: string }) {
  const apiToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;

  if (!apiToken || !phoneNumberId) {
    throw new Error('WhatsApp Cloud API not configured (missing env vars)');
  }

  const to = options.to.replace('whatsapp:', '').replace(/\+/g, '').trim();

  const res = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: options.body },
      }),
    },
  );

  const data = (await res.json()) as WhatsAppResponse;
  if (!res.ok) {
    throw new Error(
      `WhatsApp API error: ${data.error?.message ?? res.statusText}`,
    );
  }
  return { sid: data.messages?.[0]?.id ?? 'unknown', status: 'sent' };
}

// ---------------------------------------------------------------------------
// TOOL: fetch_matching_donors (v2 — with cooldown + opt-out filters)
// ---------------------------------------------------------------------------

export const fetchMatchingDonors = createTool({
  name: 'fetch_matching_donors',
  description:
    'Fetches donors matching blood group + region, excluding those in cooldown and opted-out. Always call this before any outreach.',
  parameters: z.object({
    bloodGroup: z.enum([
      'A_POSITIVE',
      'A_NEGATIVE',
      'B_POSITIVE',
      'B_NEGATIVE',
      'AB_POSITIVE',
      'AB_NEGATIVE',
      'O_POSITIVE',
      'O_NEGATIVE',
    ]),
    region: z.string(),
    excludeCooldown: z.boolean().default(true),
    excludeOptOut: z.boolean().default(true),
  }),
  execute: async ({ bloodGroup, region, excludeCooldown, excludeOptOut }) => {
    try {
      const params = new URLSearchParams({
        bloodGroup,
        region,
        excludeCooldown: String(excludeCooldown),
        excludeOptOut: String(excludeOptOut),
      });
      const res = await fetch(
        `${API_URL()}/internal/agents/donors/matching?${params.toString()}`,
        { headers: headers() },
      );
      if (!res.ok)
        return {
          success: false,
          donors: [],
          error: `API error: ${res.status}`,
        };
      const data = (await res.json()) as Array<Record<string, unknown>>;
      return { success: true, donors: data, total: data.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`fetch_matching_donors failed: ${msg}`);
      return { success: false, donors: [], error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: fetch_donor_profile
// ---------------------------------------------------------------------------

export const fetchDonorProfile = createTool({
  name: 'fetch_donor_profile',
  description:
    "Fetches a donor's full v2 profile including preferences, health notes, availability notes, and conversation state.",
  parameters: z.object({
    donorId: z.string().uuid(),
  }),
  execute: async ({ donorId }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/donors/${donorId}/profile`,
        { headers: headers() },
      );
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      const data = (await res.json()) as Record<string, unknown>;
      return { success: true, ...data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: load_donor_conversation
// Reading directly from the PostgreSQL sangroot_agent_memory tables.
// ---------------------------------------------------------------------------

export const loadDonorConversation = createTool({
  name: 'load_donor_conversation',
  description:
    'Loads the last N conversation turns for a donor from persistent memory. ALWAYS call this before composing any message to a donor.',
  parameters: z.object({
    donorId: z.string().uuid(),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  execute: async ({ donorId, limit }) => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl)
      return { success: false, error: 'DATABASE_URL not set', messages: [] };

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const userId = `donor:${donorId}`;
      // VoltAgent PostgreSQLMemoryAdapter stores messages in sangroot_agent_memory_messages
      const result = await pool.query(
        `SELECT role, parts, created_at 
         FROM sangroot_agent_memory_messages 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit],
      );
      const messages = result.rows
        .reverse()
        .map((row: { role: string; parts: unknown; created_at: string }) => {
          let content = '';
          if (Array.isArray(row.parts)) {
            content = row.parts
              .map((p: unknown) => {
                const part = p as Record<string, unknown> | null;
                return part && typeof part.text === 'string'
                  ? part.text
                  : JSON.stringify(p);
              })
              .join('\\n');
          } else {
            content = String(row.parts);
          }
          return {
            role: row.role,
            content,
            timestamp: row.created_at,
          };
        });
      return { success: true, messages, total: messages.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`load_donor_conversation: table may not exist yet — ${msg}`);
      return {
        success: true,
        messages: [],
        total: 0,
        note: 'No history found',
      };
    } finally {
      await pool.end();
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: send_donor_message
// ---------------------------------------------------------------------------

export const sendDonorMessage = createTool({
  name: 'send_donor_message',
  description:
    'Sends a WhatsApp message to a donor and logs it to their conversation thread.',
  parameters: z.object({
    donorId: z.string().uuid(),
    phone: z.string(),
    messageBody: z.string(),
    requestId: z.string().uuid().optional(),
  }),
  execute: async ({ donorId, phone, messageBody, requestId }) => {
    try {
      const result = await sendWhatsAppMessage({
        to: phone,
        body: messageBody,
      });

      // Append to conversation log
      await fetch(`${API_URL()}/internal/agents/conversations`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          donorId,
          role: 'agent',
          message: messageBody,
          requestId,
        }),
      });

      return { success: true, sid: result.sid, status: result.status };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: record_donor_response
// ---------------------------------------------------------------------------

export const recordDonorResponse = createTool({
  name: 'record_donor_response',
  description: "Records a donor's response to outreach for a blood request.",
  parameters: z.object({
    requestId: z.string().uuid(),
    donorId: z.string().uuid(),
    availability: z.enum([
      'AVAILABLE',
      'UNAVAILABLE',
      'CONDITIONAL',
      'NO_RESPONSE',
    ]),
    constraint: z.string().optional(),
  }),
  execute: async (params) => {
    try {
      const res = await fetch(`${API_URL()}/internal/agents/donor-responses`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(params),
      });
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      return { success: true, recorded: params };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: update_donor_profile
// ---------------------------------------------------------------------------

export const updateDonorProfile = createTool({
  name: 'update_donor_profile',
  description:
    "Updates a donor's profile fields (partial update — only send changed fields).",
  parameters: z.object({
    donorId: z.string().uuid(),
    preferredName: z.string().optional(),
    languagePreference: z.string().optional(),
    conversationState: z
      .enum(['ONBOARDING', 'IDLE', 'IN_OUTREACH', 'OPTED_OUT'])
      .optional(),
    onboardingComplete: z.boolean().optional(),
    lastDonationDate: z.string().optional(),
    healthNotes: z.string().optional(),
    availabilityNotes: z.string().optional(),
  }),
  execute: async ({ donorId, ...fields }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/donors/${donorId}/profile`,
        {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify(fields),
        },
      );
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      return { success: true, donorId, updated: fields };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: check_donor_eligibility
// ---------------------------------------------------------------------------

export const checkDonorEligibility = createTool({
  name: 'check_donor_eligibility',
  description:
    'Checks if a donor meets medical eligibility criteria (age, cooldown, health flags). Call BEFORE sending any outreach message.',
  parameters: z.object({
    donorId: z.string().uuid(),
  }),
  execute: async ({ donorId }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/donors/${donorId}/eligibility`,
        { headers: headers() },
      );
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      const data = (await res.json()) as Record<string, unknown>;
      return { success: true, ...data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: flag_donor_opt_out
// ---------------------------------------------------------------------------

export const flagDonorOptOut = createTool({
  name: 'flag_donor_opt_out',
  description:
    'Marks a donor as opted out. Call IMMEDIATELY when a donor sends any opt-out signal (stop, remove me, arrêtez, etc.).',
  parameters: z.object({
    donorId: z.string().uuid(),
  }),
  execute: async ({ donorId }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/donors/${donorId}/opt-out`,
        { method: 'PATCH', headers: headers() },
      );
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      return { success: true, donorId, optedOut: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// Tool array
// ---------------------------------------------------------------------------

export const donorTools = [
  fetchMatchingDonors,
  fetchDonorProfile,
  loadDonorConversation,
  sendDonorMessage,
  recordDonorResponse,
  updateDonorProfile,
  checkDonorEligibility,
  flagDonorOptOut,
];
