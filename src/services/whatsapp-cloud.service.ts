import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class WhatsAppCloudService {
  private readonly logger = new Logger(WhatsAppCloudService.name);
  private readonly apiToken: string;
  private readonly phoneNumberId: string;
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.getOrThrow<string>('WHATSAPP_CLOUD_API_TOKEN');
    this.phoneNumberId = this.config.getOrThrow<string>(
      'WHATSAPP_CLOUD_PHONE_NUMBER_ID',
    );

    if (!this.apiToken || !this.phoneNumberId) {
      this.logger.warn(
        'WhatsApp Cloud API configuration is incomplete. Sending messages will fail.',
      );
    }
  }

  async sendMessage(
    to: string,
    body: string,
  ): Promise<{ sid: string; status: string }> {
    if (!this.apiToken || !this.phoneNumberId) {
      throw new Error('WhatsApp Cloud API not configured');
    }

    // Ensure 'to' is in the format expected by WhatsApp Cloud API (no + or whatsapp: prefix)
    const formattedTo = to.replace('whatsapp:', '').replace(/\+/g, '').trim();

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedTo,
            type: 'text',
            text: {
              preview_url: false,
              body: body,
            },
          }),
        },
      );

      const data = (await response.json()) as WhatsAppResponse;

      if (!response.ok) {
        this.logger.error(
          `Error sending WhatsApp message: ${JSON.stringify(data)}`,
        );
        throw new Error(
          `WhatsApp API error: ${data.error?.message || response.statusText}`,
        );
      }

      this.logger.log(
        `WhatsApp message sent to ${formattedTo}: ${data.messages?.[0]?.id || 'unknown'}`,
      );

      return {
        sid: data.messages?.[0]?.id || 'unknown',
        status: 'sent',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send WhatsApp message: ${message}`);
      throw error;
    }
  }
}
