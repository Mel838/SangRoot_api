import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { WhatsappService, WhatsAppWebhookPayload } from './whatsapp.service';
import { ConfigService } from '@nestjs/config';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Webhook verification for WhatsApp Cloud API.
   */
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken = this.config.get<string>('WHATSAPP_CLOUD_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('WhatsApp Webhook verified successfully.');
      return challenge;
    }

    this.logger.warn('WhatsApp Webhook verification failed.');
    return 'Verification failed';
  }

  /**
   * Handling incoming messages from WhatsApp Cloud API.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: WhatsAppWebhookPayload) {
    // WhatsApp requires a 200 OK response quickly
    // We await to satisfy ESLint, but ensure processWebhook is as fast as possible.
    try {
      await this.whatsappService.processWebhook(body);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error processing WhatsApp webhook: ${message}`);
    }

    return { status: 'ok' };
  }
}
