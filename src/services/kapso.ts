import { WhatsAppClient, SendMessageResponse } from '@kapso/whatsapp-cloud-api';

export interface KapsoConfig {
  apiKey: string;
  phoneNumberId: string;
  whatsappBusinessAccountId?: string;
}

let configInstance: KapsoConfig | null = null;

/**
 * Returns the validated Kapso config singleton.
 */
export function getKapsoConfig(): KapsoConfig {
  if (configInstance) return configInstance;

  const apiKey = process.env.KAPSO_API_KEY;
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;
  const whatsappBusinessAccountId =
    process.env.KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!apiKey) throw new Error('Missing env variable: KAPSO_API_KEY');
  if (!phoneNumberId)
    throw new Error('Missing env variable: KAPSO_PHONE_NUMBER_ID');

  configInstance = { apiKey, phoneNumberId, whatsappBusinessAccountId };
  return configInstance;
}

let clientInstance: WhatsAppClient | null = null;

/**
 * Returns the Kapso WhatsApp client singleton.
 */
export function getKapsoClient(): WhatsAppClient {
  if (!clientInstance) {
    const config = getKapsoConfig();
    clientInstance = new WhatsAppClient({
      kapsoApiKey: config.apiKey,
      // The base URL for the Kapso Meta Proxy.
      // Note: The SDK automatically appends '/v23.0/' (or current graphVersion) to this.
      baseUrl: 'https://api.kapso.ai/meta/whatsapp',
    });
  }
  return clientInstance;
}

export interface SendWhatsAppOptions {
  to: string;
  body: string;
}

export interface KapsoMessageResult {
  sid: string;
  status: string;
  channel: 'whatsapp';
}

/**
 * Send a WhatsApp message via Kapso.
 */
export async function sendWhatsAppMessage(
  options: SendWhatsAppOptions,
): Promise<KapsoMessageResult> {
  const client = getKapsoClient();
  const config = getKapsoConfig();

  // Ensure 'to' is in E.164 format and strip "whatsapp:" if present
  const to = options.to.replace('whatsapp:', '').replace(/\+/g, '').trim();

  // In the Kapso SDK, phoneNumberId is passed as part of the message input
  const response: SendMessageResponse = await client.messages.sendText({
    phoneNumberId: config.phoneNumberId,
    to,
    body: options.body,
  });

  // The SDK might throw on error, but if it returns a response,
  // we check for message ID. Most Graph-like responses have it.
  const sid = response.messages?.[0]?.id || 'unknown';

  return {
    sid,
    status: 'sent',
    channel: 'whatsapp',
  };
}
