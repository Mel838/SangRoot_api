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
}

export interface WhatsAppChange {
  value: WhatsAppChangeValue;
  field: string;
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export class WhatsAppWebhookPayload {
  object: string;
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
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') {
      return;
    }

    const from = message.from; // E.164 without + e.g. "237612345678"
    const textBody = message.text.body;

    this.logger.log(`Received message from ${from}: ${textBody}`);

    // -----------------------------------------------------------------------
    // 1. Identity resolution via PhoneNumberRegistry (v2)
    // -----------------------------------------------------------------------
    const registry = await this.prisma.phoneNumberRegistry.findFirst({
      where: {
        OR: [{ phone: from }, { phone: `+${from}` }],
      },
    });

    if (!registry) {
      this.logger.warn(`No entity registered for phone: ${from}`);
      return;
    }

    const entityType = registry.entityType as 'DONOR' | 'BLOOD_BANK';
    const entityId = registry.entityId;

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
    // 4. Build context and route to Donor Coordinator
    // -----------------------------------------------------------------------
    const sessionKey =
      entityType === 'DONOR' ? `donor:${entityId}` : `bloodbank:${entityId}`;

    this.logger.log(
      `Routing message [${entityType}:${entityId}] → Donor Coordinator (session: ${sessionKey})`,
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
        userId: sessionKey,
        context: new Map<string | symbol, unknown>([
          ['donorCoordinatorContext', donorContext],
        ]),
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Donor coordinator error for ${sessionKey}: ${msg}`);
      });
  }
}
