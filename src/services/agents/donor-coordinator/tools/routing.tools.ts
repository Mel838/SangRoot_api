import { createTool } from '@voltagent/core';
import { z } from 'zod';
import { Logger } from '@nestjs/common';

const logger = new Logger('RoutingTools');

const API_URL = () => process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
const API_KEY = () => process.env.AGENT_API_KEY ?? '';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-agent-key': API_KEY(),
});

// ---------------------------------------------------------------------------
// TOOL: resolve_sender_identity
// ---------------------------------------------------------------------------

export const resolveSenderIdentity = createTool({
  name: 'resolve_sender_identity',
  description:
    'Resolves a WhatsApp phone number to an entity (DONOR or BLOOD_BANK). Call this at the start of every incoming message handler.',
  parameters: z.object({
    phone: z
      .string()
      .describe('Phone number as received from WhatsApp (without +)'),
  }),
  execute: async ({ phone }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/resolve-sender/${encodeURIComponent(phone)}`,
        { headers: headers() },
      );
      if (!res.ok)
        return {
          success: false,
          error: `API error: ${res.status}`,
          entityType: 'UNKNOWN',
        };
      const data = (await res.json()) as {
        entityType: 'DONOR' | 'BLOOD_BANK' | 'UNKNOWN';
        entityId: string | null;
        entityName: string | null;
        languagePreference: string;
      };
      return { success: true, ...data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg, entityType: 'UNKNOWN' };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: get_active_request_for_entity
// ---------------------------------------------------------------------------

export const getActiveRequestForEntity = createTool({
  name: 'get_active_request_for_entity',
  description:
    'Finds the most recent IN_PROGRESS blood request that this entity (donor or blood bank) was contacted for. Returns null if none.',
  parameters: z.object({
    entityId: z.string().uuid(),
    entityType: z.enum(['DONOR', 'BLOOD_BANK']),
  }),
  execute: async ({ entityId, entityType }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/active-request/${entityId}?entityType=${entityType}`,
        { headers: headers() },
      );
      if (!res.ok)
        return {
          success: false,
          error: `API error: ${res.status}`,
          activeRequest: null,
        };
      const data = (await res.json()) as Record<string, unknown> | null;
      return { success: true, activeRequest: data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg, activeRequest: null };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: classify_message_intent
// Inline LLM call — lightweight gpt-4o-mini classification
// ---------------------------------------------------------------------------

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message: string };
}

export const classifyMessageIntent = createTool({
  name: 'classify_message_intent',
  description:
    "Classifies an incoming message's intent. Returns: YES | NO | QUESTION | OPT_OUT | BLOOD_BANK_RESPONSE | UNCLEAR. Always call this when handling an incoming message.",
  parameters: z.object({
    messageText: z.string(),
    language: z.string().default('FR').describe('"FR" or "EN"'),
  }),
  execute: async ({ messageText, language }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      return {
        success: false,
        error: 'OPENAI_API_KEY not set',
        intent: 'UNCLEAR',
      };

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 50,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: `You are a message intent classifier for a blood donation platform.
Classify the following message into exactly one of these intents:
- YES: donor/blood bank confirms availability or agreement (oui, yes, ok, d'accord, disponible, je peux)
- NO: donor declines (non, no, pas disponible, je ne peux pas, indisponible)
- QUESTION: sender is asking a question
- OPT_OUT: sender wants to stop receiving messages (stop, remove me, arrêtez, ne plus me contacter, désabonner)
- BLOOD_BANK_RESPONSE: a blood bank reporting stock availability (includes numbers/quantities)
- UNCLEAR: message is ambiguous or unrelated

Respond with ONLY the intent word and optionally a parsedQuantity (integer) if BLOOD_BANK_RESPONSE.
Format: {"intent": "INTENT", "parsedQuantity": N_or_null}
Language hint: ${language}`,
            },
            { role: 'user', content: messageText },
          ],
        }),
      });

      const data = (await res.json()) as OpenAIResponse;
      if (!res.ok) {
        return {
          success: false,
          error: data.error?.message ?? 'OpenAI error',
          intent: 'UNCLEAR',
        };
      }

      const content =
        data.choices?.[0]?.message?.content ?? '{"intent":"UNCLEAR"}';
      try {
        const parsed = JSON.parse(content) as {
          intent: string;
          parsedQuantity?: number | null;
        };
        return {
          success: true,
          intent: parsed.intent,
          parsedQuantity: parsed.parsedQuantity ?? null,
        };
      } catch {
        logger.warn(
          `classify_message_intent: failed to parse response: ${content}`,
        );
        return { success: true, intent: 'UNCLEAR', parsedQuantity: null };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg, intent: 'UNCLEAR' };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: notify_doctor_coordinator
// ---------------------------------------------------------------------------

export const notifyDoctorCoordinator = createTool({
  name: 'notify_doctor_coordinator',
  description:
    'Sends a callback event to the Doctor Coordinator when a significant outreach event occurs (donor confirmed, supply reached, outreach complete).',
  parameters: z.object({
    requestId: z.string().uuid(),
    event: z.enum([
      'DONOR_CONFIRMED',
      'SUFFICIENT_REACHED',
      'OUTREACH_COMPLETE',
    ]),
    details: z.record(z.string(), z.unknown()),
  }),
  execute: async (params) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/doctor-coordinator/callbacks`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(params),
        },
      );
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      return { success: true, event: params.event };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// Tool array
// ---------------------------------------------------------------------------

export const routingTools = [
  resolveSenderIdentity,
  getActiveRequestForEntity,
  classifyMessageIntent,
  notifyDoctorCoordinator,
];
