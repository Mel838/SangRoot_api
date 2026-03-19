import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BloodGroup, CameroonRegion, DonorAvailability } from '@prisma/client';
import { RecordDonorResponseDto } from './dto/record-donor-response.dto';
import { RecordBloodBankResponseDto } from './dto/record-blood-bank-response.dto';
import { FinalReportDto } from './dto/final-report.dto';
// import { sendWhatsAppMessage } from '../../services/kapso';

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
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // GET /internal/agents/donors
  // Returns donors matching bloodGroup + town + region (for agent outreach)
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

  // ---------------------------------------------------------------------------
  // GET /internal/agents/blood-banks
  // Returns blood banks in a given town + region
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // POST /internal/agents/donor-responses
  // Upserts the donor's response for a blood request
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // POST /internal/agents/blood-bank-responses
  // Upserts a blood bank's availability response for a blood request
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // GET /internal/agents/eligibility-summary/:requestId
  // Aggregates donor + blood bank responses and applies eligibility rules
  // ---------------------------------------------------------------------------
  async getEligibilitySummary(requestId: string) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: requestId },
      select: { id: true, requiredBy: true },
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
    //const FIFTY_SIX_DAYS_MS = 56 * 24 * 60 * 60 * 1000;
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
        continue; // Not available — skip eligibility checks
      }

      // Age check
      const ageMs = now.getTime() - new Date(dr.donor.dateBirth).getTime();
      const ageyears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      if (ageyears < MIN_AGE || ageyears > MAX_AGE) {
        ineligibleCount++;
        exclusionReasons.push(
          `1 donor excluded: age out of range (${Math.floor(ageyears)} years)`,
        );
        continue;
      }

      // 56-day cooldown — we don't track last donation yet, so we trust the AVAILABLE status
      // Future: query DonationHistory table here.

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

  // ---------------------------------------------------------------------------
  // POST /internal/agents/final-report
  // Saves the agent's final report and updates BloodRequest status
  // ---------------------------------------------------------------------------
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
