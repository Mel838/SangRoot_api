import { createTool } from '@voltagent/core';
import { z } from 'zod';
// import { sendWhatsAppMessage } from '../kapso';
import { Logger } from '@nestjs/common';

const logger = new Logger('WhatsAppTools');

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

/**
 * Send a WhatsApp message via WhatsApp Cloud API.
 */
async function sendWhatsAppMessage(options: { to: string; body: string }) {
  const apiToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;

  if (!apiToken || !phoneNumberId) {
    throw new Error('WhatsApp Cloud API not configured (missing env vars)');
  }

  const to = options.to.replace('whatsapp:', '').replace(/\+/g, '').trim();

  const response = await fetch(
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
        to: to,
        type: 'text',
        text: {
          preview_url: false,
          body: options.body,
        },
      }),
    },
  );

  const data = (await response.json()) as WhatsAppResponse;

  if (!response.ok) {
    logger.error(`Error sending WhatsApp message: ${JSON.stringify(data)}`);
    throw new Error(
      `WhatsApp API error: ${data.error?.message || response.statusText}`,
    );
  }

  return {
    sid: data.messages?.[0]?.id || 'unknown',
    status: 'sent',
  };
}

// ---------------------------------------------------------------------------
// Helper: Format blood group for human-readable messages
// ---------------------------------------------------------------------------

function formatBloodGroup(bg: string): string {
  return bg
    .replace('_POSITIVE', '+')
    .replace('_NEGATIVE', '-')
    .replace(/_/g, '');
}

// ---------------------------------------------------------------------------
// DONOR OUTREACH AGENT TOOLS
// ---------------------------------------------------------------------------

export const fetchMatchingDonors = createTool({
  name: 'fetch_matching_donors',
  description:
    'Fetch registered donors that match the required blood group and are located in the same region as the requesting hospital. Returns donor IDs, first names, phone numbers, and date of birth (for eligibility checks). Always call this before sending any messages.',
  parameters: z.object({
    bloodGroup: z
      .enum([
        'A_POSITIVE',
        'A_NEGATIVE',
        'B_POSITIVE',
        'B_NEGATIVE',
        'AB_POSITIVE',
        'AB_NEGATIVE',
        'O_POSITIVE',
        'O_NEGATIVE',
      ])
      .describe('The required blood group'),
    region: z.string().describe('The Cameroon region (e.g. CENTRE, LITTORAL)'),
  }),
  execute: async ({ bloodGroup, region }) => {
    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
    const apiKey = process.env.AGENT_API_KEY ?? '';

    const res = await fetch(
      `${apiUrl}/internal/agents/donors?bloodGroup=${bloodGroup}&region=${region}`,
      { headers: { 'x-agent-key': apiKey } },
    );

    if (!res.ok) {
      return { success: false, donors: [], error: `API error: ${res.status}` };
    }

    const data = (await res.json()) as Array<{
      id: string;
      name: string;
      phone: string;
      dateBirth: string;
      region: string;
    }>;

    return {
      success: true,
      donors: data.map((d) => ({
        id: d.id,
        firstName: d.name.split(' ')[0],
        phone: d.phone,
        name: d.name, // Added full name for doctor notification later
      })),
      total: data.length,
    };
  },
});

export const sendDonorOutreachMessage = createTool({
  name: 'send_donor_outreach_message',
  description:
    "Send a WhatsApp (or SMS fallback) outreach message to a donor. Use the personalized message body crafted from the donor's first name, blood group, hospital, and urgency level. Returns the message SID for tracking.",
  parameters: z.object({
    donorPhone: z
      .string()
      .describe('Donor phone number in E.164 format (e.g. +237612345678)'),
    messageBody: z
      .string()
      .describe('The full, personalized message body to send to the donor'),
  }),
  execute: async ({ donorPhone, messageBody }) => {
    try {
      const result = await sendWhatsAppMessage({
        to: donorPhone,
        body: messageBody,
      });
      return { success: true, sid: result.sid, status: result.status };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  },
});

export const recordDonorResponse = createTool({
  name: 'record_donor_response',
  description:
    "Record a donor's response to outreach for a given blood request. Use this after receiving a reply (or after the follow-up timeout). Persists the outcome so the Eligibility & Timing Agent can process it.",
  parameters: z.object({
    requestId: z.string().uuid().describe('The BloodRequest ID'),
    donorId: z.string().uuid().describe('The Donor ID'),
    availability: z
      .enum(['AVAILABLE', 'UNAVAILABLE', 'CONDITIONAL', 'NO_RESPONSE'])
      .describe("The donor's availability status"),
    constraint: z
      .string()
      .optional()
      .describe(
        "Any constraint mentioned by the donor (e.g. 'only available after 5pm')",
      ),
  }),
  execute: async ({ requestId, donorId, availability, constraint }) => {
    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
    const apiKey = process.env.AGENT_API_KEY ?? '';

    const res = await fetch(`${apiUrl}/internal/agents/donor-responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': apiKey },
      body: JSON.stringify({ requestId, donorId, availability, constraint }),
    });

    if (!res.ok) {
      return { success: false, error: `API error: ${res.status}` };
    }

    return { success: true, recorded: { requestId, donorId, availability } };
  },
});

// ---------------------------------------------------------------------------
// BLOOD BANK LIAISON AGENT TOOLS
// ---------------------------------------------------------------------------

export const fetchNearbyBloodBanks = createTool({
  name: 'fetch_nearby_blood_banks',
  description:
    'Fetch registered blood banks located in the same town as the requesting hospital. Returns blood bank IDs, names, and phone numbers. Call this before sending any notifications.',
  parameters: z.object({
    town: z.string().describe('The town where the hospital is located'),
    region: z.string().describe('The Cameroon region'),
  }),
  execute: async ({ town, region }) => {
    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
    const apiKey = process.env.AGENT_API_KEY ?? '';

    const res = await fetch(
      `${apiUrl}/internal/agents/blood-banks?town=${encodeURIComponent(town)}&region=${region}`,
      { headers: { 'x-agent-key': apiKey } },
    );

    if (!res.ok) {
      return {
        success: false,
        bloodBanks: [],
        error: `API error: ${res.status}`,
      };
    }

    const data = (await res.json()) as Array<{
      id: string;
      name: string;
      phone: string;
      town: string;
      region: string;
    }>;

    return { success: true, bloodBanks: data, total: data.length };
  },
});

export const sendBloodBankNotification = createTool({
  name: 'send_blood_bank_notification',
  description:
    'Send a WhatsApp notification to a blood bank requesting availability information for a specific blood group and unit count. Returns the Twilio message SID.',
  parameters: z.object({
    bloodBankPhone: z
      .string()
      .describe('Blood bank phone number in E.164 format (e.g. +237699000000)'),
    bloodBankName: z.string().describe('Name of the blood bank (for logging)'),
    bloodGroup: z
      .enum([
        'A_POSITIVE',
        'A_NEGATIVE',
        'B_POSITIVE',
        'B_NEGATIVE',
        'AB_POSITIVE',
        'AB_NEGATIVE',
        'O_POSITIVE',
        'O_NEGATIVE',
      ])
      .describe('Required blood group'),
    unitsRequired: z.number().int().min(1).describe('Number of units needed'),
    hospitalName: z.string().describe('Requesting hospital name'),
    town: z.string().describe('Hospital town'),
    urgency: z
      .enum(['CRITICAL', 'URGENT', 'ROUTINE'])
      .describe('Urgency level of the request'),
  }),
  execute: async ({
    bloodBankPhone,
    bloodBankName,
    bloodGroup,
    unitsRequired,
    hospitalName,
    town,
    urgency,
  }) => {
    const urgencyLabel =
      urgency === 'CRITICAL'
        ? '🚨 CRITIQUE'
        : urgency === 'URGENT'
          ? '⚠️ URGENT'
          : '📋 ROUTINE';

    const body =
      `Bonjour ${bloodBankName}, SangRoot vous contacte au nom de ${hospitalName} à ${town}.\n` +
      `Nous avons besoin de ${unitsRequired} unité(s) de sang groupe ${formatBloodGroup(bloodGroup)} — priorité : ${urgencyLabel}.\n` +
      `Avez-vous ce groupe en stock ? Combien d'unités et dans quel délai ?\n` +
      `Merci de répondre rapidement. 🙏`;

    try {
      const result = await sendWhatsAppMessage({ to: bloodBankPhone, body });
      return {
        success: true,
        sid: result.sid,
        status: result.status,
        bloodBankName,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, bloodBankName };
    }
  },
});

export const recordBloodBankResponse = createTool({
  name: 'record_blood_bank_response',
  description:
    "Record a blood bank's availability response for a given blood request. Persists units available and preparation time so the Eligibility & Timing Agent can include it in its assessment.",
  parameters: z.object({
    requestId: z.string().uuid().describe('The BloodRequest ID'),
    bloodBankId: z.string().uuid().describe('The BloodBank ID'),
    available: z
      .boolean()
      .describe('Whether the blood bank has stock of the required group'),
    unitsAvailable: z
      .number()
      .int()
      .min(0)
      .describe('Number of units available (0 if none)'),
    preparationTimeMinutes: z
      .number()
      .int()
      .min(0)
      .describe('Time in minutes to prepare/deliver the units'),
    notes: z
      .string()
      .optional()
      .describe('Any additional notes from the blood bank'),
  }),
  execute: async ({
    requestId,
    bloodBankId,
    available,
    unitsAvailable,
    preparationTimeMinutes,
    notes,
  }) => {
    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
    const apiKey = process.env.AGENT_API_KEY ?? '';

    const res = await fetch(`${apiUrl}/internal/agents/blood-bank-responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': apiKey },
      body: JSON.stringify({
        requestId,
        bloodBankId,
        available,
        unitsAvailable,
        preparationTimeMinutes,
        notes,
      }),
    });

    if (!res.ok) {
      return { success: false, error: `API error: ${res.status}` };
    }

    return {
      success: true,
      recorded: { requestId, bloodBankId, available, unitsAvailable },
    };
  },
});

// ---------------------------------------------------------------------------
// RESULT REPORTING AGENT TOOLS
// ---------------------------------------------------------------------------

export const fetchEligibilitySummary = createTool({
  name: 'fetch_eligibility_summary',
  description:
    "Fetch the eligibility-filtered summary for a blood request. This includes eligible donor count, conditional donor count, blood bank availability, and the overall SUFFICIENT/PARTIAL/INSUFFICIENT assessment. Call this before generating the doctor's report.",
  parameters: z.object({
    requestId: z.string().uuid().describe('The BloodRequest ID'),
  }),
  execute: async ({ requestId }) => {
    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
    const apiKey = process.env.AGENT_API_KEY ?? '';

    const res = await fetch(
      `${apiUrl}/internal/agents/eligibility-summary/${requestId}`,
      { headers: { 'x-agent-key': apiKey } },
    );

    if (!res.ok) {
      return { success: false, error: `API error: ${res.status}` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    return { success: true, ...data };
  },
});

export const persistFinalReport = createTool({
  name: 'persist_final_report',
  description:
    'Save the final structured report to the BloodRequest record and update its status. This makes the summary visible to the requesting doctor in the app.',
  parameters: z.object({
    requestId: z.string().uuid().describe('The BloodRequest ID'),
    status: z
      .enum(['FULFILLED', 'IN_PROGRESS', 'EXPIRED'])
      .describe('New status for the BloodRequest'),
    reportMarkdown: z
      .string()
      .describe(
        'The full doctor-facing report in Markdown format (no personal donor data)',
      ),
    willingDonorCount: z
      .number()
      .int()
      .min(0)
      .describe('Number of confirmed willing donors'),
    donorsContacted: z
      .number()
      .int()
      .min(0)
      .describe('Total donors contacted during outreach'),
  }),
  execute: async ({
    requestId,
    status,
    reportMarkdown,
    willingDonorCount,
    donorsContacted,
  }) => {
    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
    const apiKey = process.env.AGENT_API_KEY ?? '';

    const res = await fetch(`${apiUrl}/internal/agents/final-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-key': apiKey },
      body: JSON.stringify({
        requestId,
        status,
        reportMarkdown,
        willingDonorCount,
        donorsContacted,
        aiProcessedAt: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      return { success: false, error: `API error: ${res.status}` };
    }

    return { success: true, requestId, status };
  },
});

export const sendDoctorProgressUpdate = createTool({
  name: 'send_doctor_progress_update',
  description:
    'Send a concise WhatsApp progress update to the requesting doctor. Use for high-level updates and the final summary. Never include raw donor data.',
  parameters: z.object({
    doctorPhone: z
      .string()
      .describe("Doctor's phone number in E.164 format (e.g. +237677000000)"),
    messageBody: z
      .string()
      .describe(
        'The progress update message. Must not contain donor names, phone numbers, or raw conversation content.',
      ),
  }),
  execute: async ({ doctorPhone, messageBody }) => {
    try {
      const result = await sendWhatsAppMessage({
        to: doctorPhone,
        body: messageBody,
      });
      return { success: true, sid: result.sid, status: result.status };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  },
});

// ---------------------------------------------------------------------------
// Tool arrays per agent (for use in agents.ts)
// ---------------------------------------------------------------------------

export const donorOutreachAgentTools = [
  fetchMatchingDonors,
  sendDonorOutreachMessage,
  recordDonorResponse,
];

export const bloodBankLiaisonAgentTools = [
  fetchNearbyBloodBanks,
  sendBloodBankNotification,
  recordBloodBankResponse,
];

// Eligibility & Timing Agent uses pure reasoning — no external tools needed.
export const eligibilityTimingAgentTools: never[] = [];

export const resultReportingAgentTools = [
  fetchEligibilitySummary,
  persistFinalReport,
  sendDoctorProgressUpdate,
];

// Progress report to doctor
export const coordinatorAgentTools = [sendDoctorProgressUpdate];
