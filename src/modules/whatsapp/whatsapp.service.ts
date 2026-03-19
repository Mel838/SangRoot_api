import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { COORDINATOR_AGENT_TOKEN } from '../../services/agents/voltagent.module';
import type { Agent } from '@voltagent/core';
import { BloodRequestContext } from '../../services/agents/prompts';

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
    @Inject(COORDINATOR_AGENT_TOKEN) private readonly coordinator: Agent,
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

    const from = message.from; // Sender's phone number
    const textBody = message.text.body;

    this.logger.log(`Received message from ${from}: ${textBody}`);

    // 1. Find donor or blood bank by phone number
    // Note: Phone numbers in DB might have + prefix or not.
    // WhatsApp 'from' is usually without +.
    const donor = await this.prisma.donor.findFirst({
      where: {
        OR: [{ phone: from }, { phone: `+${from}` }],
      },
    });

    const bloodBank = await this.prisma.bloodBank.findFirst({
      where: {
        OR: [{ phone: from }, { phone: `+${from}` }],
      },
    });

    if (!donor && !bloodBank) {
      this.logger.warn(
        `No donor or blood bank found for phone number: ${from}`,
      );
      return;
    }

    // 2. Find the most recent active blood request for this user
    let activeRequest = null;

    if (donor) {
      const donorResponse = await this.prisma.donorResponse.findFirst({
        where: {
          donorId: donor.id,
          request: {
            status: 'IN_PROGRESS',
          },
        },
        orderBy: {
          request: {
            createdAt: 'desc',
          },
        },
        include: {
          request: true,
        },
      });
      activeRequest = donorResponse?.request;
    } else if (bloodBank) {
      const bloodBankResponse = await this.prisma.bloodBankResponse.findFirst({
        where: {
          bloodBankId: bloodBank.id,
          request: {
            status: 'IN_PROGRESS',
          },
        },
        orderBy: {
          request: {
            createdAt: 'desc',
          },
        },
        include: {
          request: true,
        },
      });
      activeRequest = bloodBankResponse?.request;
    }

    if (!activeRequest) {
      this.logger.warn(
        `No active blood request found for ${donor ? 'donor' : 'blood bank'} ${from}`,
      );
      return;
    }

    // 3. Forward message to the agent coordinator
    this.logger.log(
      `Routing message from ${from} to coordinator for request ${activeRequest.id}`,
    );

    // We need to rebuild the context for the agent
    const requester = await this.prisma.doctor.findUnique({
      where: { userId: activeRequest.requesterId },
      select: { phone: true },
    });

    const bloodRequestContext: BloodRequestContext = {
      requestId: activeRequest.id,
      bloodGroup: activeRequest.bloodGroup,
      unitsRequired: activeRequest.unitsRequired,
      urgency: activeRequest.urgency,
      hospitalName: activeRequest.hospitalName,
      town: activeRequest.town,
      region: activeRequest.region,
      requiredBy: activeRequest.requiredBy.toISOString(),
      patientAge: activeRequest.patientAge,
      patientGender: activeRequest.patientGender,
      medicalReason: activeRequest.medicalReason ?? undefined,
      doctorPhone: requester?.phone || '',
    };

    const agentMessage = `Incoming message from ${donor ? 'donor' : 'blood bank'} (${from}): ${textBody}`;

    await this.coordinator.generateText(agentMessage, {
      userId: activeRequest.id,
      context: new Map<string | symbol, unknown>([
        ['bloodRequest', bloodRequestContext],
      ]),
    });
  }
}
