import { createTool } from '@voltagent/core';
import { z } from 'zod';
import { Logger } from '@nestjs/common';
import { Pool } from 'pg';

const logger = new Logger('BloodBankTools');

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
// TOOL: fetch_nearby_blood_banks
// ---------------------------------------------------------------------------

export const fetchNearbyBloodBanks = createTool({
  name: 'fetch_nearby_blood_banks',
  description:
    'Fetches registered blood banks in the specified town and region.',
  parameters: z.object({
    town: z.string(),
    region: z.string(),
  }),
  execute: async ({ town, region }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/blood-banks?town=${encodeURIComponent(town)}&region=${region}`,
        { headers: headers() },
      );
      if (!res.ok)
        return {
          success: false,
          bloodBanks: [],
          error: `API error: ${res.status}`,
        };
      const data = (await res.json()) as Array<Record<string, unknown>>;
      return { success: true, bloodBanks: data, total: data.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, bloodBanks: [], error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: fetch_blood_bank_profile
// ---------------------------------------------------------------------------

export const fetchBloodBankProfile = createTool({
  name: 'fetch_blood_bank_profile',
  description:
    "Fetches a blood bank's v2 profile including contact name and language preference.",
  parameters: z.object({
    bankId: z.string().uuid(),
  }),
  execute: async ({ bankId }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/blood-banks/${bankId}/profile`,
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
// TOOL: load_blood_bank_conversation
// ---------------------------------------------------------------------------

export const loadBloodBankConversation = createTool({
  name: 'load_blood_bank_conversation',
  description:
    'Loads the last N conversation turns for a blood bank from persistent memory. ALWAYS call before messaging a blood bank.',
  parameters: z.object({
    bankId: z.string().uuid(),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  execute: async ({ bankId, limit }) => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl)
      return { success: false, error: 'DATABASE_URL not set', messages: [] };

    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const userId = `bloodbank:${bankId}`;
      const result = await pool.query(
        `SELECT role, content, created_at 
         FROM sangroot_agent_memory_messages 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit],
      );
      const messages = result.rows
        .reverse()
        .map((row: { role: string; content: string; created_at: string }) => ({
          role: row.role,
          content: row.content,
          timestamp: row.created_at,
        }));
      return { success: true, messages, total: messages.length };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`load_blood_bank_conversation: ${msg}`);
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
// TOOL: send_blood_bank_message
// ---------------------------------------------------------------------------

export const sendBloodBankMessage = createTool({
  name: 'send_blood_bank_message',
  description:
    'Sends a WhatsApp message to a blood bank and logs it to their conversation thread.',
  parameters: z.object({
    bankId: z.string().uuid(),
    phone: z.string(),
    messageBody: z.string(),
    requestId: z.string().uuid().optional(),
  }),
  execute: async ({ bankId, phone, messageBody, requestId }) => {
    try {
      const result = await sendWhatsAppMessage({
        to: phone,
        body: messageBody,
      });

      await fetch(`${API_URL()}/internal/agents/blood-bank-conversations`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          bankId,
          role: 'agent',
          message: messageBody,
          requestId,
        }),
      });

      return { success: true, sid: result.sid };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: record_blood_bank_response
// ---------------------------------------------------------------------------

export const recordBloodBankResponse = createTool({
  name: 'record_blood_bank_response',
  description:
    "Records a blood bank's availability response for a blood request.",
  parameters: z.object({
    requestId: z.string().uuid(),
    bloodBankId: z.string().uuid(),
    available: z.boolean(),
    unitsAvailable: z.number().int().min(0),
    preparationTimeMinutes: z.number().int().min(0),
    notes: z.string().optional(),
  }),
  execute: async (params) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/blood-bank-responses`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(params),
        },
      );
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      return { success: true, recorded: params };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: update_blood_bank_profile
// ---------------------------------------------------------------------------

export const updateBloodBankProfile = createTool({
  name: 'update_blood_bank_profile',
  description: "Updates a blood bank's profile fields (partial update).",
  parameters: z.object({
    bankId: z.string().uuid(),
    contactName: z.string().optional(),
    languagePreference: z.string().optional(),
    conversationState: z.enum(['IDLE', 'IN_OUTREACH']).optional(),
  }),
  execute: async ({ bankId, ...fields }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/blood-banks/${bankId}/profile`,
        {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify(fields),
        },
      );
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      return { success: true, bankId, updated: fields };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// Tool array
// ---------------------------------------------------------------------------

export const bloodBankTools = [
  fetchNearbyBloodBanks,
  fetchBloodBankProfile,
  loadBloodBankConversation,
  sendBloodBankMessage,
  recordBloodBankResponse,
  updateBloodBankProfile,
];
