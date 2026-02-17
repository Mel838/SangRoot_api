import { createTool } from '@voltagent/core';
import { z } from 'zod';

export const sendWhatsAppMessage = createTool({
  name: 'send_whatsapp_message',
  description: 'Sends a WhatsApp message to a donor or blood bank.',
  parameters: z.object({
    phoneNumber: z.string(),
    message: z.string(),
  }),
  execute: async ({ phoneNumber }) => {
    // integrate Twilio / Meta API here
    await Promise.resolve();
    return { status: 'sent', phoneNumber };
  },
});

export const recordDonorConsent = createTool({
  name: 'record_donor_consent',
  description: 'Records explicit donor consent response.',
  parameters: z.object({
    donorId: z.string(),
    consent: z.boolean(),
  }),
  execute: async () => {
    await Promise.resolve();
    return { saved: true };
  },
});

export const emitDoctorSummary = createTool({
  name: 'emit_doctor_summary',
  description: 'Sends final structured summary back to NestJS backend.',
  parameters: z.object({
    requestId: z.string(),
    summary: z.string(),
  }),
  execute: async () => {
    await Promise.resolve();
    return { delivered: true };
  },
});
