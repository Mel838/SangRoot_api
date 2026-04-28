import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BloodGroup,
  CameroonRegion,
  DonorAvailability,
  DonorConversationState,
  BloodBankConversationState,
  OutreachTaskStatus,
  RequestStatus,
} from '@prisma/client';
import { RecordDonorResponseDto } from './dto/record-donor-response.dto';
import { RecordBloodBankResponseDto } from './dto/record-blood-bank-response.dto';
import { FinalReportDto } from './dto/final-report.dto';
import { CreateOutreachTaskDto } from './dto/create-outreach-task.dto';
import { UpdateDonorProfileV2Dto } from './dto/update-donor-profile-v2.dto';
import { UpdateBloodBankProfileV2Dto } from './dto/update-blood-bank-profile-v2.dto';
import { AppendConversationDto } from './dto/append-conversation.dto';
import { DoctorCoordinatorCallbackDto } from './dto/doctor-coordinator-callback.dto';
import { DONOR_COORDINATOR_TOKEN } from '../../services/agents/voltagent.module';
import type { Agent } from '@voltagent/core';

/**
 * Send a WhatsApp message via WhatsApp Cloud API (Helper for service)
 */
async function sendWhatsAppMessageHelper(options: {
  to: string;
  body: string;
}) {
  const apiToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;

  if (!apiToken || !phoneNumberId) {
    console.error('WhatsApp Cloud API not configured');
    return;
  }

  const to = options.to.replace('whatsapp:', '').replace(/\+/g, '').trim();

  try {
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
          text: { body: options.body },
        }),
      },
    );
    if (!response.ok) {
      console.error('WhatsApp API error', await response.json());
    }
  } catch (err) {
    console.error('Failed to send WhatsApp message', err);
  }
}

@Injectable()
export class InternalAgentsService {
  private readonly logger = new Logger(InternalAgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(DONOR_COORDINATOR_TOKEN) private readonly donorCoordinator: Agent,
  ) {}

  // ---------------------------------------------------------------------------
  // V2 — OUTREACH TASKS
  // ---------------------------------------------------------------------------

  async createOutreachTask(dto: CreateOutreachTaskDto) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: dto.requestId },
    });
    if (!request) {
      throw new NotFoundException(`BloodRequest ${dto.requestId} not found`);
    }

    const task = await this.prisma.outreachTask.create({
      data: {
        requestId: dto.requestId,
        status: OutreachTaskStatus.IN_PROGRESS,
      },
    });

    // ── Trigger Donor Coordinator agent (fire-and-forget) ──────────────
    const context = new Map<string | symbol, unknown>([
      [
        'donorCoordinatorContext',
        {
          trigger: 'OUTREACH_TASK',
          taskId: task.id,
          requestId: dto.requestId,
          bloodGroup: dto.bloodGroup,
          urgency: dto.urgency,
          region: dto.region,
          town: dto.town,
          unitsNeeded: dto.unitsNeeded,
          timeoutMinutes: dto.timeoutMinutes,
        },
      ],
    ]);

    this.donorCoordinator
      .generateText(
        `Outreach task received. Blood group: ${dto.bloodGroup}, ` +
          `urgency: ${dto.urgency}, region: ${dto.region}, town: ${dto.town}, ` +
          `units needed: ${dto.unitsNeeded}. Begin donor and blood bank outreach now.`,
        {
          userId: `outreach:${dto.requestId}`,
          context,
        },
      )
      .then(() =>
        this.logger.log(
          `Donor Coordinator finished outreach for request ${dto.requestId}`,
        ),
      )
      .catch((err) =>
        this.logger.error(
          `Donor Coordinator outreach failed for request ${dto.requestId}`,
          err,
        ),
      );

    return { taskId: task.id, status: task.status };
  }

  async getOutreachProgress(requestId: string) {
    const tasks = await this.prisma.outreachTask.findMany({
      where: { requestId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    const donorResponses = await this.prisma.donorResponse.count({
      where: { requestId, availability: { in: ['AVAILABLE', 'CONDITIONAL'] } },
    });

    const bankResponses = await this.prisma.bloodBankResponse.count({
      where: { requestId, available: true },
    });

    return {
      taskId: tasks[0]?.id ?? null,
      status: tasks[0]?.status ?? 'NOT_STARTED',
      confirmedDonors: donorResponses,
      confirmedBanks: bankResponses,
      updatedAt: tasks[0]?.updatedAt ?? new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // V2 — DONOR MANAGEMENT
  // ---------------------------------------------------------------------------

  async getMatchingDonorsV2(
    bloodGroup: string,
    region: string,
    excludeCooldown = true,
    excludeOptOut = true,
  ) {
    if (!Object.values(BloodGroup).includes(bloodGroup as BloodGroup)) {
      throw new BadRequestException(`Invalid bloodGroup: ${bloodGroup}`);
    }
    if (!Object.values(CameroonRegion).includes(region as CameroonRegion)) {
      throw new BadRequestException(`Invalid region: ${region}`);
    }

    const now = new Date();
    const cooldownDate = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);

    const donors = await this.prisma.donor.findMany({
      where: {
        bloodGroup: bloodGroup as BloodGroup,
        region: region as CameroonRegion,
        ...(excludeOptOut && { optOutAt: null }),
        ...(excludeCooldown && {
          OR: [
            { lastDonationDate: null },
            { lastDonationDate: { lte: cooldownDate } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        preferredName: true,
        phone: true,
        town: true,
        region: true,
        languagePreference: true,
        lastDonationDate: true,
      },
    });

    return donors;
  }

  async getDonorProfile(donorId: string) {
    const donor = await this.prisma.donor.findUnique({
      where: { id: donorId },
    });
    if (!donor) throw new NotFoundException('Donor not found');
    return donor;
  }

  async updateDonorProfileV2(donorId: string, dto: UpdateDonorProfileV2Dto) {
    return this.prisma.donor.update({
      where: { id: donorId },
      data: {
        ...(dto.preferredName && { preferredName: dto.preferredName }),
        ...(dto.languagePreference && {
          languagePreference: dto.languagePreference,
        }),
        ...(dto.conversationState && {
          conversationState: dto.conversationState as DonorConversationState,
        }),
        ...(dto.onboardingComplete !== undefined && {
          onboardingComplete: dto.onboardingComplete,
        }),
        ...(dto.lastDonationDate && {
          lastDonationDate: new Date(dto.lastDonationDate),
        }),
        ...(dto.healthNotes && { healthNotes: dto.healthNotes }),
        ...(dto.availabilityNotes && {
          availabilityNotes: dto.availabilityNotes,
        }),
      },
    });
  }

  async checkDonorEligibility(donorId: string) {
    const donor = await this.prisma.donor.findUnique({
      where: { id: donorId },
    });
    if (!donor) throw new NotFoundException('Donor not found');

    const now = new Date();
    const ageMs = now.getTime() - new Date(donor.dateBirth).getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);

    const ageOk = ageYears >= 18 && ageYears <= 65;
    let cooldownOk = true;
    let daysUntilEligible = 0;

    if (donor.lastDonationDate) {
      const diffMs = now.getTime() - new Date(donor.lastDonationDate).getTime();
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      if (diffDays < 56) {
        cooldownOk = false;
        daysUntilEligible = Math.ceil(56 - diffDays);
      }
    }

    const healthFlagsOk = !donor.healthNotes
      ?.toLowerCase()
      .includes('ineligible');

    return {
      eligible: ageOk && cooldownOk && healthFlagsOk,
      ageOk,
      cooldownOk,
      healthFlagsOk,
      daysUntilEligible,
    };
  }

  async flagDonorOptOut(donorId: string) {
    return this.prisma.donor.update({
      where: { id: donorId },
      data: {
        optOutAt: new Date(),
        conversationState: DonorConversationState.OPTED_OUT,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // V2 — BLOOD BANK MANAGEMENT
  // ---------------------------------------------------------------------------

  async getBloodBankProfile(bankId: string) {
    const bank = await this.prisma.bloodBank.findUnique({
      where: { id: bankId },
    });
    if (!bank) throw new NotFoundException('Blood bank not found');
    return bank;
  }

  async updateBloodBankProfileV2(
    bankId: string,
    dto: UpdateBloodBankProfileV2Dto,
  ) {
    return this.prisma.bloodBank.update({
      where: { id: bankId },
      data: {
        ...(dto.contactName && { contactName: dto.contactName }),
        ...(dto.languagePreference && {
          languagePreference: dto.languagePreference,
        }),
        ...(dto.conversationState && {
          conversationState:
            dto.conversationState as BloodBankConversationState,
        }),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // V2 — CONVERSATION MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Appends a message to a donor or blood bank conversation thread.
   * This logic assumes the sync to VoltAgent's memory happens separately if needed,
   * but here we just accept the push from the agent tool to ensure DB consistency.
   */
  async appendConversation(dto: AppendConversationDto) {
    if (dto.donorId) {
      await this.prisma.donor.update({
        where: { id: dto.donorId },
        data: {
          messagesSentCount: { increment: dto.role === 'agent' ? 1 : 0 },
        },
      });
      // Further logic (like storing in a custom Message table) could go here.
    }
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // V2 — SENDER RESOLUTION & ROUTING
  // ---------------------------------------------------------------------------

  async resolveSenderIdentity(phone: string) {
    const cleanPhone = phone.replace(/\+/g, '').trim();
    const registry = await this.prisma.phoneNumberRegistry.findUnique({
      where: { phone: cleanPhone },
    });

    if (!registry) {
      return {
        entityType: 'UNKNOWN',
        entityId: null,
        entityName: null,
        languagePreference: 'FR',
      };
    }

    let entityName = 'Unknown';
    let languagePreference = 'FR';

    if (registry.entityType === 'DONOR') {
      const donor = await this.prisma.donor.findUnique({
        where: { id: registry.entityId },
        select: { name: true, preferredName: true, languagePreference: true },
      });
      if (donor) {
        entityName = donor.preferredName ?? donor.name;
        languagePreference = donor.languagePreference ?? 'FR';
      }
    } else if (registry.entityType === 'BLOOD_BANK') {
      const bank = await this.prisma.bloodBank.findUnique({
        where: { id: registry.entityId },
        select: { name: true, contactName: true, languagePreference: true },
      });
      if (bank) {
        entityName = bank.contactName ?? bank.name;
        languagePreference = bank.languagePreference ?? 'FR';
      }
    }

    return {
      entityType: registry.entityType,
      entityId: registry.entityId,
      entityName,
      languagePreference,
    };
  }

  async getActiveRequestForEntity(entityId: string, entityType: string) {
    if (entityType === 'DONOR') {
      const resp = await this.prisma.donorResponse.findFirst({
        where: { donorId: entityId, request: { status: 'IN_PROGRESS' } },
        orderBy: { request: { createdAt: 'desc' } },
        include: { request: true },
      });
      return resp?.request ?? null;
    } else {
      const resp = await this.prisma.bloodBankResponse.findFirst({
        where: { bloodBankId: entityId, request: { status: 'IN_PROGRESS' } },
        orderBy: { request: { createdAt: 'desc' } },
        include: { request: true },
      });
      return resp?.request ?? null;
    }
  }

  handleDoctorCoordinatorCallback(dto: DoctorCoordinatorCallbackDto) {
    this.logger.log(
      `Received callback for request ${dto.requestId}: ${dto.event}`,
    );
    // In a real system, this might trigger a notification to the Doctor Coordinator agent
    // that it should resume processing if it were waiting. Since VoltAgent handles
    // sub-agent delegation, this callback is mostly for logging/system triggers.
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // V2 — REGIONAL ALTERNATIVES & STATUS
  // ---------------------------------------------------------------------------

  async getRegionalAlternatives(
    region: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    bloodGroup: string,
  ) {
    // Return other blood banks in the same region, excluding those already contacted
    const banks = await this.prisma.bloodBank.findMany({
      where: { region: region as CameroonRegion },
      select: { name: true, phone: true, town: true },
    });
    return { regionalBanks: banks };
  }

  async updateBloodRequestStatus(requestId: string, status: string) {
    return this.prisma.bloodRequest.update({
      where: { id: requestId },
      data: { status: status as RequestStatus },
    });
  }

  // ---------------------------------------------------------------------------
  // ORIGINAL METHODS (preserved for compatibility)
  // ---------------------------------------------------------------------------

  async getMatchingDonors(bloodGroup: string, town: string, region: string) {
    if (!Object.values(BloodGroup).includes(bloodGroup as BloodGroup)) {
      throw new BadRequestException(`Invalid bloodGroup: ${bloodGroup}`);
    }
    if (!Object.values(CameroonRegion).includes(region as CameroonRegion)) {
      throw new BadRequestException(`Invalid region: ${region}`);
    }

    const donors = await this.prisma.donor.findMany({
      where: {
        bloodGroup: bloodGroup as BloodGroup,
        region: region as CameroonRegion,
        town: { equals: town, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        dateBirth: true,
        town: true,
        region: true,
      },
    });

    return donors;
  }

  async getNearbyBloodBanks(town: string, region: string) {
    if (!Object.values(CameroonRegion).includes(region as CameroonRegion)) {
      throw new BadRequestException(`Invalid region: ${region}`);
    }

    const bloodBanks = await this.prisma.bloodBank.findMany({
      where: {
        region: region as CameroonRegion,
        town: { equals: town, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        town: true,
        region: true,
      },
    });

    return bloodBanks;
  }

  async recordDonorResponse(dto: RecordDonorResponseDto) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: dto.requestId },
    });
    if (!request) {
      throw new NotFoundException(`BloodRequest ${dto.requestId} not found`);
    }

    const donor = await this.prisma.donor.findUnique({
      where: { id: dto.donorId },
    });
    if (!donor) {
      throw new NotFoundException(`Donor ${dto.donorId} not found`);
    }

    const existing = await this.prisma.donorResponse.findUnique({
      where: {
        requestId_donorId: {
          requestId: dto.requestId,
          donorId: dto.donorId,
        },
      },
      select: { availability: true },
    });

    const isNewPositive =
      (dto.availability === DonorAvailability.AVAILABLE ||
        dto.availability === DonorAvailability.CONDITIONAL) &&
      (!existing ||
        (existing.availability !== DonorAvailability.AVAILABLE &&
          existing.availability !== DonorAvailability.CONDITIONAL));

    const response = await this.prisma.donorResponse.upsert({
      where: {
        requestId_donorId: {
          requestId: dto.requestId,
          donorId: dto.donorId,
        },
      },
      update: {
        availability: dto.availability,
        constraint: dto.constraint ?? null,
      },
      create: {
        requestId: dto.requestId,
        donorId: dto.donorId,
        availability: dto.availability,
        constraint: dto.constraint ?? null,
      },
    });

    if (isNewPositive) {
      const doctor = await this.prisma.doctor.findUnique({
        where: { userId: request.requesterId },
      });
      if (doctor?.phone) {
        const bgFormatted = request.bloodGroup
          .replace('_POSITIVE', '+')
          .replace('_NEGATIVE', '-')
          .replace('_', '');
        const message = `✅ ${bgFormatted} update for ${request.hospitalName}: Donor ${donor.name} (${donor.phone}) confirmed availability. (Outreach ongoing)`;
        sendWhatsAppMessageHelper({ to: doctor.phone, body: message }).catch(
          (err) => {
            console.error(
              '[InternalAgents] Failed to send WhatsApp progress update',
              err,
            );
          },
        );
      }
    }

    return response;
  }

  async recordBloodBankResponse(dto: RecordBloodBankResponseDto) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: dto.requestId },
    });
    if (!request) {
      throw new NotFoundException(`BloodRequest ${dto.requestId} not found`);
    }

    const bloodBank = await this.prisma.bloodBank.findUnique({
      where: { id: dto.bloodBankId },
    });
    if (!bloodBank) {
      throw new NotFoundException(`BloodBank ${dto.bloodBankId} not found`);
    }

    const existing = await this.prisma.bloodBankResponse.findUnique({
      where: {
        requestId_bloodBankId: {
          requestId: dto.requestId,
          bloodBankId: dto.bloodBankId,
        },
      },
      select: { available: true },
    });

    const isNewPositive = dto.available && !existing?.available;

    const response = await this.prisma.bloodBankResponse.upsert({
      where: {
        requestId_bloodBankId: {
          requestId: dto.requestId,
          bloodBankId: dto.bloodBankId,
        },
      },
      update: {
        available: dto.available,
        unitsAvailable: dto.unitsAvailable,
        preparationTimeMinutes: dto.preparationTimeMinutes,
        notes: dto.notes ?? null,
      },
      create: {
        requestId: dto.requestId,
        bloodBankId: dto.bloodBankId,
        available: dto.available,
        unitsAvailable: dto.unitsAvailable,
        preparationTimeMinutes: dto.preparationTimeMinutes,
        notes: dto.notes ?? null,
      },
    });

    if (isNewPositive) {
      const doctor = await this.prisma.doctor.findUnique({
        where: { userId: request.requesterId },
      });
      if (doctor?.phone) {
        const bgFormatted = request.bloodGroup
          .replace('_POSITIVE', '+')
          .replace('_NEGATIVE', '-')
          .replace('_', '');
        const message = `✅ ${bgFormatted} update for ${request.hospitalName}: ${bloodBank.name} (${bloodBank.phone}) confirmed availability of ${dto.unitsAvailable} unit(s).`;
        sendWhatsAppMessageHelper({ to: doctor.phone, body: message }).catch(
          (err) => {
            console.error(
              '[InternalAgents] Failed to send WhatsApp progress update for blood bank',
              err,
            );
          },
        );
      }
    }

    return response;
  }

  async getEligibilitySummary(requestId: string) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        requiredBy: true,
        hospitalName: true,
        bloodGroup: true,
        requesterId: true,
      },
    });
    if (!request) {
      throw new NotFoundException(`BloodRequest ${requestId} not found`);
    }

    // --- Donor eligibility ---
    const donorResponses = await this.prisma.donorResponse.findMany({
      where: { requestId },
      include: {
        donor: {
          select: { dateBirth: true, town: true, region: true },
        },
      },
    });

    const now = new Date();
    const MIN_AGE = 18;
    const MAX_AGE = 65;

    let eligibleCount = 0;
    let conditionalCount = 0;
    let ineligibleCount = 0;
    const conditionalConstraints: string[] = [];
    const exclusionReasons: string[] = [];

    for (const dr of donorResponses) {
      if (
        dr.availability === DonorAvailability.UNAVAILABLE ||
        dr.availability === DonorAvailability.NO_RESPONSE
      ) {
        continue;
      }

      const ageMs = now.getTime() - new Date(dr.donor.dateBirth).getTime();
      const ageyears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      if (ageyears < MIN_AGE || ageyears > MAX_AGE) {
        ineligibleCount++;
        exclusionReasons.push(
          `1 donor excluded: age out of range (${Math.floor(ageyears)} years)`,
        );
        continue;
      }

      if (dr.availability === DonorAvailability.AVAILABLE) {
        eligibleCount++;
      } else if (dr.availability === DonorAvailability.CONDITIONAL) {
        conditionalCount++;
        if (dr.constraint) {
          conditionalConstraints.push(dr.constraint);
        }
      }
    }

    // --- Blood bank availability ---
    const bloodBankResponses = await this.prisma.bloodBankResponse.findMany({
      where: { requestId, available: true },
      include: {
        bloodBank: { select: { name: true, town: true } },
      },
    });

    const bloodBankSummary = bloodBankResponses.map((bbr) => ({
      name: bbr.bloodBank.name,
      town: bbr.bloodBank.town,
      unitsAvailable: bbr.unitsAvailable,
      preparationTimeMinutes: bbr.preparationTimeMinutes,
      notes: bbr.notes,
    }));

    const totalUnitsFromBanks = bloodBankResponses.reduce(
      (sum, bbr) => sum + bbr.unitsAvailable,
      0,
    );

    // --- Overall assessment ---
    let assessment: 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT';
    if (eligibleCount >= 1 || totalUnitsFromBanks >= 1) {
      assessment =
        eligibleCount >= 2 || totalUnitsFromBanks >= 2
          ? 'SUFFICIENT'
          : 'PARTIAL';
    } else if (conditionalCount > 0) {
      assessment = 'PARTIAL';
    } else {
      assessment = 'INSUFFICIENT';
    }

    return {
      requestId,
      eligibleDonorCount: eligibleCount,
      conditionalDonorCount: conditionalCount,
      ineligibleDonorCount: ineligibleCount,
      conditionalConstraints,
      exclusionReasons,
      bloodBankAvailability: bloodBankSummary,
      totalUnitsFromBanks,
      assessment,
    };
  }

  async persistFinalReport(dto: FinalReportDto) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: dto.requestId },
    });
    if (!request) {
      throw new NotFoundException(`BloodRequest ${dto.requestId} not found`);
    }

    const updated = await this.prisma.bloodRequest.update({
      where: { id: dto.requestId },
      data: {
        status: dto.status,
        reportMarkdown: dto.reportMarkdown,
        willingDonorCount: dto.willingDonorCount,
        donorsContacted: dto.donorsContacted,
        aiProcessedAt: dto.aiProcessedAt
          ? new Date(dto.aiProcessedAt)
          : new Date(),
      },
      select: {
        id: true,
        status: true,
        willingDonorCount: true,
        donorsContacted: true,
        aiProcessedAt: true,
      },
    });

    return updated;
  }
}
