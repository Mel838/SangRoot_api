import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DONOR_COORDINATOR_TOKEN } from '../../services/agents/voltagent.module';
import type { Agent } from '@voltagent/core';
import type { DonorCoordinatorContext } from '../../services/agents/donor-coordinator/prompts';

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text: {
    body: string;
  };
  type: string;
}

export interface WhatsAppChangeValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: {
      name: string;
    };
    wa_id: string;
  }>;
  messages?: WhatsAppMessage[];
  statuses?: Array<Record<string, unknown>>;
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: string;
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

import { Allow } from 'class-validator';

export class WhatsAppWebhookPayload {
  @Allow()
  object: string;

  @Allow()
  entry: WhatsAppEntry[];
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(DONOR_COORDINATOR_TOKEN) private readonly donorCoordinator: Agent,
  ) {}

  async processWebhook(body: WhatsAppWebhookPayload) {
    this.logger.debug(`Received WhatsApp webhook: ${JSON.stringify(body)}`);

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // -----------------------------------------------------------------------
    // Guard: distinguish real messages from status updates
    // -----------------------------------------------------------------------
    if (value?.statuses && !value?.messages) {
      this.logger.debug(
        `Webhook is a status update (delivered/read/sent), skipping.`,
      );
      return;
    }

    const message = value?.messages?.[0];

    if (!message) {
      this.logger.debug(
        'Webhook payload has no messages array — ignoring (likely a status-only event).',
      );
      return;
    }

    if (message.type !== 'text') {
      this.logger.debug(
        `Ignoring non-text message type: "${message.type}" from ${message.from}`,
      );
      return;
    }

    const from = message.from; // E.164 without + e.g. "237612345678"
    const textBody = message.text.body;
    const waMessageId = message.id;

    this.logger.log(
      `📩 Incoming text from ${from} [wamid: ${waMessageId}]: "${textBody}"`,
    );

    // -----------------------------------------------------------------------
    // 1. Identity resolution — PhoneNumberRegistry first, then fallback
    // -----------------------------------------------------------------------
    let registry = await this.prisma.phoneNumberRegistry.findFirst({
      where: {
        OR: [{ phone: from }, { phone: `+${from}` }],
      },
    });

    // Fallback: if registry has no match, look up directly in Donor / BloodBank
    if (!registry) {
      this.logger.warn(
        `PhoneNumberRegistry has no entry for ${from}. Trying direct donor/blood bank lookup...`,
      );

      const resolvedEntity = await this.resolveEntityByPhone(from);

      if (!resolvedEntity) {
        this.logger.warn(
          `❌ No entity found for phone ${from} in any table. Message dropped.`,
        );
        return;
      }

      // Auto-populate the registry so future messages are fast
      registry = await this.prisma.phoneNumberRegistry.create({
        data: {
          phone: from,
          entityType: resolvedEntity.entityType,
          entityId: resolvedEntity.entityId,
        },
      });

      this.logger.log(
        `✅ Auto-created PhoneNumberRegistry entry: ${from} → ${resolvedEntity.entityType}:${resolvedEntity.entityId}`,
      );
    }

    const entityType = registry.entityType as 'DONOR' | 'BLOOD_BANK';
    const entityId = registry.entityId;

    this.logger.log(
      `🔍 Resolved sender: ${entityType}:${entityId} (phone: ${from})`,
    );

    // -----------------------------------------------------------------------
    // 2. Look up entity display name + language
    // -----------------------------------------------------------------------
    let entityName: string = 'Unknown';
    let entityLanguage = 'FR';

    if (entityType === 'DONOR') {
      const donor = await this.prisma.donor.findUnique({
        where: { id: entityId },
        select: { name: true, preferredName: true, languagePreference: true },
      });
      if (donor) {
        entityName = donor.preferredName ?? donor.name;
        entityLanguage = donor.languagePreference ?? 'FR';
      }
    } else {
      const bank = await this.prisma.bloodBank.findUnique({
        where: { id: entityId },
        select: { name: true, contactName: true, languagePreference: true },
      });
      if (bank) {
        entityName = bank.contactName ?? bank.name;
        entityLanguage = bank.languagePreference ?? 'FR';
      }
    }

    // -----------------------------------------------------------------------
    // 3. Find active blood request for this entity
    // -----------------------------------------------------------------------
    let activeRequestId: string | null = null;

    if (entityType === 'DONOR') {
      const donorResponse = await this.prisma.donorResponse.findFirst({
        where: {
          donorId: entityId,
          request: { status: 'IN_PROGRESS' },
        },
        orderBy: { request: { createdAt: 'desc' } },
        select: { request: { select: { id: true } } },
      });
      activeRequestId = donorResponse?.request.id ?? null;
    } else {
      const bankResponse = await this.prisma.bloodBankResponse.findFirst({
        where: {
          bloodBankId: entityId,
          request: { status: 'IN_PROGRESS' },
        },
        orderBy: { request: { createdAt: 'desc' } },
        select: { request: { select: { id: true } } },
      });
      activeRequestId = bankResponse?.request.id ?? null;
    }

    // -----------------------------------------------------------------------
    // 4. Store the incoming message in the conversation thread
    //    This ensures the agent sees the donor's reply when it loads history.
    // -----------------------------------------------------------------------
    await this.storeIncomingMessage(
      entityType,
      entityId,
      textBody,
      activeRequestId,
    );

    // -----------------------------------------------------------------------
    // 5. Build context and route to Donor Coordinator
    // -----------------------------------------------------------------------
    const sessionKey =
      entityType === 'DONOR' ? `donor:${entityId}` : `bloodbank:${entityId}`;

    this.logger.log(
      `🚀 Routing message [${entityType}:${entityId}] → Donor Coordinator (session: ${sessionKey})`,
    );

    const donorContext: DonorCoordinatorContext = {
      trigger: 'INCOMING_MESSAGE',
      entityType,
      entityId,
      entityName,
      entityLanguage,
      incomingMessage: textBody,
      activeRequestId,
    };

    const agentMessage = `Incoming WhatsApp message from ${entityType.toLowerCase()} "${entityName}" (${from}): "${textBody}"`;

    // Fire-and-forget — do not block the webhook response
    this.donorCoordinator
      .generateText(agentMessage, {
        memory: {
          userId: sessionKey,
          conversationId: activeRequestId ?? `session:${entityId}`,
          options: { contextLimit: 50 },
        },
        context: new Map<string | symbol, unknown>([
          ['donorCoordinatorContext', donorContext],
        ]),
      })
      .then((result: unknown) => {
        this.logger.log(
          `✅ Donor coordinator completed for ${sessionKey}. Response length: ${
            String(result).length
          } chars`,
        );
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `❌ Donor coordinator error for ${sessionKey}: ${msg}`,
        );
        if (err instanceof Error && err.stack) {
          this.logger.error(`Stack trace: ${err.stack}`);
        }
      });
  }

  // -------------------------------------------------------------------------
  // PRIVATE HELPERS
  // -------------------------------------------------------------------------

  /**
   * Resolves a phone number directly from the Donor or BloodBank tables.
   * Used as a fallback when PhoneNumberRegistry has no entry.
   */
  private async resolveEntityByPhone(
    phone: string,
  ): Promise<{ entityType: 'DONOR' | 'BLOOD_BANK'; entityId: string } | null> {
    // Try Donor first — check both formats
    const donor = await this.prisma.donor.findFirst({
      where: {
        OR: [
          { phone: phone },
          { phone: `+${phone}` },
          { phone: phone.replace(/^\+/, '') },
        ],
      },
      select: { id: true },
    });

    if (donor) {
      this.logger.log(`Found donor by phone fallback: ${donor.id}`);
      return { entityType: 'DONOR', entityId: donor.id };
    }

    // Try BloodBank
    const bank = await this.prisma.bloodBank.findFirst({
      where: {
        OR: [
          { phone: phone },
          { phone: `+${phone}` },
          { phone: phone.replace(/^\+/, '') },
        ],
      },
      select: { id: true },
    });

    if (bank) {
      this.logger.log(`Found blood bank by phone fallback: ${bank.id}`);
      return { entityType: 'BLOOD_BANK', entityId: bank.id };
    }

    return null;
  }

  /**
   * Stores an incoming message in the conversation thread via the internal API.
   * This ensures the agent sees the user's messages when it loads conversation history.
   */
  private async storeIncomingMessage(
    entityType: 'DONOR' | 'BLOOD_BANK',
    entityId: string,
    message: string,
    requestId: string | null,
  ): Promise<void> {
    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://localhost:3000';
    const apiKey = process.env.AGENT_API_KEY ?? '';

    const endpoint = `${apiUrl}/internal/agents/conversations`;
    const idField = entityType === 'DONOR' ? 'donorId' : 'bankId';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-agent-key': apiKey,
        },
        body: JSON.stringify({
          [idField]: entityId,
          role: 'user',
          message,
          requestId,
        }),
      });

      if (!res.ok) {
        this.logger.warn(
          `Failed to store incoming message (${res.status}): ${await res.text()}`,
        );
      } else {
        this.logger.debug(
          `📝 Stored incoming message for ${entityType}:${entityId}`,
        );
      }
    } catch (err) {
      // Non-critical — don't block webhook processing
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not store incoming message: ${msg}. Continuing with agent invocation.`,
      );
    }
  }
}
