import { createTool } from '@voltagent/core';
import { z } from 'zod';
import { Logger } from '@nestjs/common';

const logger = new Logger('DoctorCoordinatorTools');

const API_URL = () => process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
const API_KEY = () => process.env.AGENT_API_KEY ?? '';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-agent-key': API_KEY(),
});

// ---------------------------------------------------------------------------
// WhatsApp helper (same pattern as tools.ts)
// ---------------------------------------------------------------------------

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
// TOOL: trigger_donor_coordinator
// ---------------------------------------------------------------------------

export const triggerDonorCoordinator = createTool({
  name: 'trigger_donor_coordinator',
  description:
    'Delegates an outreach task to the Donor Coordinator. Blocks until the outreach is complete (status: COMPLETE) before returning, so the doctor coordinator can proceed directly to the eligibility report.',
  parameters: z.object({
    requestId: z.string().uuid(),
    bloodGroup: z.string(),
    urgency: z.enum(['ROUTINE', 'URGENT', 'CRITICAL']),
    region: z.string(),
    town: z.string(),
    unitsNeeded: z.number().int().min(1),
    searchRadiusKm: z.number().int().min(1),
    timeoutMinutes: z.number().int().min(1),
  }),
  execute: async (params) => {
    // Step 1: Create the outreach task (returns immediately with IN_PROGRESS).
    let taskId: string;
    try {
      const res = await fetch(`${API_URL()}/internal/agents/outreach-tasks`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(params),
      });
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      const data = (await res.json()) as { taskId: string; status: string };
      taskId = data.taskId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`trigger_donor_coordinator failed: ${msg}`);
      return { success: false, error: msg };
    }

    // Step 2: Poll outreach-progress until the donor coordinator finishes
    // (marks status COMPLETE) or until the polling window expires.
    // Polling avoids holding an HTTP connection open during the multi-minute run.
    const POLL_INTERVAL_MS = 15_000; // 15 seconds between checks
    const MAX_WAIT_MS = 12 * 60 * 1000; // 12-minute ceiling regardless of urgency
    const deadline = Date.now() + MAX_WAIT_MS;

    while (Date.now() < deadline) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, POLL_INTERVAL_MS),
      );

      try {
        const progressRes = await fetch(
          `${API_URL()}/internal/agents/outreach-progress/${params.requestId}`,
          { headers: headers() },
        );
        if (progressRes.ok) {
          const progress = (await progressRes.json()) as {
            status: string;
            taskId: string | null;
          };
          if (progress.status === 'COMPLETE') {
            logger.log(
              `Outreach complete for request ${params.requestId} (taskId: ${taskId})`,
            );
            return { success: true, taskId, status: 'COMPLETE' };
          }
        }
      } catch {
        // Transient error — keep polling
      }
    }

    // Polling window expired — outreach is still running but proceed anyway.
    logger.warn(
      `Outreach polling timed out for request ${params.requestId}. Proceeding to eligibility report with available data.`,
    );
    return { success: true, taskId, status: 'TIMEOUT' };
  },
});

// ---------------------------------------------------------------------------
// TOOL: fetch_outreach_progress
// ---------------------------------------------------------------------------

export const fetchOutreachProgress = createTool({
  name: 'fetch_outreach_progress',
  description:
    'Fetches real-time outreach progress for a blood request. Call this periodically to check on the status and notify the doctor at milestones.',
  parameters: z.object({
    requestId: z.string().uuid(),
  }),
  execute: async ({ requestId }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/outreach-progress/${requestId}`,
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
// TOOL: fetch_eligibility_summary
// ---------------------------------------------------------------------------

export const fetchEligibilitySummary = createTool({
  name: 'fetch_eligibility_summary',
  description:
    'Fetches the final eligibility-filtered summary for a blood request. Call this before generating the doctor report.',
  parameters: z.object({
    requestId: z.string().uuid(),
  }),
  execute: async ({ requestId }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/eligibility-summary/${requestId}`,
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
// TOOL: persist_final_report
// ---------------------------------------------------------------------------

export const persistFinalReport = createTool({
  name: 'persist_final_report',
  description:
    'Saves the final Markdown report and updates the BloodRequest record.',
  parameters: z.object({
    requestId: z.string().uuid(),
    status: z.enum(['FULFILLED', 'IN_PROGRESS', 'EXPIRED']),
    reportMarkdown: z.string(),
    willingDonorCount: z.number().int().min(0),
    donorsContacted: z.number().int().min(0),
  }),
  execute: async (params) => {
    try {
      const res = await fetch(`${API_URL()}/internal/agents/final-report`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          ...params,
          aiProcessedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      return { success: true, requestId: params.requestId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: send_doctor_notification
// ---------------------------------------------------------------------------

export const sendDoctorNotification = createTool({
  name: 'send_doctor_notification',
  description:
    'Sends a WhatsApp message to the requesting doctor. Keep messages concise and calm — max 3 sentences. Never include donor personal data.',
  parameters: z.object({
    doctorPhone: z.string().describe("Doctor's phone in E.164 format"),
    messageBody: z.string().describe('The message to send. No PII.'),
  }),
  execute: async ({ doctorPhone, messageBody }) => {
    try {
      const result = await sendWhatsAppMessage({
        to: doctorPhone,
        body: messageBody,
      });
      return { success: true, sid: result.sid };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// TOOL: fetch_regional_alternatives
// ---------------------------------------------------------------------------

export const fetchRegionalAlternatives = createTool({
  name: 'fetch_regional_alternatives',
  description:
    'Fetches nearby hospitals and blood authority contacts in the region. Call this when outcome is INSUFFICIENT and urgency is URGENT or CRITICAL.',
  parameters: z.object({
    region: z.string(),
    bloodGroup: z.string(),
  }),
  execute: async ({ region, bloodGroup }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/regional-alternatives?region=${region}&bloodGroup=${bloodGroup}`,
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
// TOOL: update_request_status
// ---------------------------------------------------------------------------

export const updateRequestStatus = createTool({
  name: 'update_request_status',
  description:
    'Updates the BloodRequest status. Call at Step 4 (IN_PROGRESS) and Step 9 (final outcome).',
  parameters: z.object({
    requestId: z.string().uuid(),
    status: z.enum(['IN_PROGRESS', 'FULFILLED', 'EXPIRED']),
  }),
  execute: async ({ requestId, status }) => {
    try {
      const res = await fetch(
        `${API_URL()}/internal/agents/blood-requests/${requestId}/status`,
        {
          method: 'PATCH',
          headers: headers(),
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) return { success: false, error: `API error: ${res.status}` };
      return { success: true, requestId, status };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },
});

// ---------------------------------------------------------------------------
// Tool arrays per agent
// ---------------------------------------------------------------------------

export const doctorCoordinatorTools = [
  triggerDonorCoordinator,
  fetchOutreachProgress,
  fetchEligibilitySummary,
  persistFinalReport,
  sendDoctorNotification,
  fetchRegionalAlternatives,
  updateRequestStatus,
];
