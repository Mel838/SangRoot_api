import twilio, { Twilio } from 'twilio';
import { sendWhatsAppMessage as sendWhatsAppViaKapso } from './kapso';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** Twilio WhatsApp sender — must include the "whatsapp:" prefix, e.g. whatsapp:+14155238886 */
  whatsappFrom: string;
  /** Twilio SMS sender in E.164 format, e.g. +14155238886 */
  smsFrom: string;
}

let configInstance: TwilioConfig | null = null;

/**
 * Returns the validated Twilio config singleton.
 * Throws clearly if any required env variable is missing.
 */
export function getTwilioConfig(): TwilioConfig {
  if (configInstance) return configInstance;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
  const smsFrom = process.env.TWILIO_SMS_FROM;

  if (!accountSid) throw new Error('Missing env variable: TWILIO_ACCOUNT_SID');
  if (!authToken) throw new Error('Missing env variable: TWILIO_AUTH_TOKEN');
  if (!whatsappFrom)
    throw new Error('Missing env variable: TWILIO_WHATSAPP_FROM');
  if (!smsFrom) throw new Error('Missing env variable: TWILIO_SMS_FROM');

  if (!accountSid.startsWith('AC')) {
    throw new Error("TWILIO_ACCOUNT_SID must start with 'AC'");
  }

  if (!whatsappFrom.startsWith('whatsapp:')) {
    throw new Error(
      "TWILIO_WHATSAPP_FROM must start with 'whatsapp:' (e.g. whatsapp:+14155238886)",
    );
  }

  configInstance = { accountSid, authToken, whatsappFrom, smsFrom };
  return configInstance;
}

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let clientInstance: Twilio | null = null;

/**
 * Returns the Twilio client singleton, initializing it on first use.
 */
export function getTwilioClient(): Twilio {
  if (!clientInstance) {
    const config = getTwilioConfig();
    clientInstance = twilio(config.accountSid, config.authToken);
  }
  return clientInstance;
}

// ---------------------------------------------------------------------------
// Sending options & result types
// ---------------------------------------------------------------------------

export interface SendWhatsAppOptions {
  /** Recipient phone number in E.164 format, e.g. +237612345678 (no "whatsapp:" prefix needed) */
  to: string;
  /** Message body text */
  body: string;
  /** Optional media URL(s) — images, audio, documents */
  mediaUrl?: string | string[];
}

export interface SendSmsOptions {
  /** Recipient phone number in E.164 format, e.g. +237612345678 */
  to: string;
  /** Message body text */
  body: string;
}

export interface MessageResult {
  sid: string;
  status: string;
  channel: 'whatsapp' | 'sms';
}

// ---------------------------------------------------------------------------
// WhatsApp sending
// ---------------------------------------------------------------------------

/**
 * Send a WhatsApp message via Kapso (formerly Twilio).
 *
 * [MIGRATION NOTE]: This now uses Kapso under the hood to fulfill the requirement
 * of switching WhatsApp provider while maintaining the same interface for existing code.
 */
export async function sendWhatsAppMessage(
  options: SendWhatsAppOptions,
): Promise<MessageResult> {
  const result = await sendWhatsAppViaKapso(options);
  return { sid: result.sid, status: result.status, channel: 'whatsapp' };
}

// ---------------------------------------------------------------------------
// SMS fallback sending
// ---------------------------------------------------------------------------

/**
 * Send a plain SMS message via Twilio.
 * Use this as a fallback when WhatsApp delivery fails or the recipient
 * has not opted in to WhatsApp.
 */
export async function sendSmsMessage(
  options: SendSmsOptions,
): Promise<MessageResult> {
  const config = getTwilioConfig();
  const client = getTwilioClient();

  const message = await client.messages.create({
    from: config.smsFrom,
    to: options.to,
    body: options.body,
  });

  return { sid: message.sid, status: message.status, channel: 'sms' };
}

// ---------------------------------------------------------------------------
// WhatsApp with SMS fallback
// ---------------------------------------------------------------------------

/**
 * Attempt to send via WhatsApp first. If it throws, fall back to SMS.
 * Returns the result of whichever channel succeeded.
 *
 * Use this for donor outreach where WhatsApp is preferred but SMS must be
 * the safety net for recipients without WhatsApp.
 */
export async function sendWithFallback(
  options: SendWhatsAppOptions,
): Promise<MessageResult> {
  try {
    return await sendWhatsAppMessage(options);
  } catch (whatsappError) {
    console.warn(
      `[SangRoot Twilio] WhatsApp failed for ${options.to}, falling back to SMS.`,
      whatsappError instanceof Error ? whatsappError.message : whatsappError,
    );
    return await sendSmsMessage({ to: options.to, body: options.body });
  }
}
