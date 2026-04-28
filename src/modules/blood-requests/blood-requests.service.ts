import { Injectable, Inject, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import type { Agent } from '@voltagent/core';
import type { BloodRequestContext } from '../../services/agents/prompts';
import { COORDINATOR_AGENT_TOKEN } from '../../services/agents/voltagent.module';

@Injectable()
export class BloodRequestsService {
  private readonly logger = new Logger(BloodRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(COORDINATOR_AGENT_TOKEN) private readonly coordinator: Agent,
  ) {}

  /**
   * Create a blood request and fire-and-forget the AI agent coordinator.
   * The doctor receives an immediate response; the agent works in the background.
   */
  async create(requesterId: string, dto: CreateBloodRequestDto) {
    // 1. Persist the request
    const request = await this.prisma.bloodRequest.create({
      data: {
        requesterId,
        bloodGroup: dto.bloodGroup,
        unitsRequired: dto.unitsRequired,
        urgency: dto.urgency,
        patientName: dto.patientName,
        patientAge: dto.patientAge,
        patientGender: dto.patientGender,
        hospitalName: dto.hospitalName,
        region: dto.region,
        town: dto.town,
        neighbourhood: dto.neighbourhood,
        requiredBy: new Date(dto.requiredBy),
        medicalReason: dto.medicalReason,
        notes: dto.notes,
      },
    });

    // 2. Kick off the AI agent (fire-and-forget — don't await)
    this.triggerAgent(request).catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `Failed to trigger agent for request ${request.id}: ${error.message}`,
        error.stack,
      );
    });

    return request;
  }

  /**
   * Trigger the VoltAgent coordinator with the blood request context.
   */
  private async triggerAgent(request: {
    id: string;
    requesterId: string;
    bloodGroup: string;
    unitsRequired: number;
    urgency: string;
    hospitalName: string;
    town: string;
    region: string;
    requiredBy: Date;
    patientAge: number;
    patientGender: string;
    medicalReason: string | null;
  }) {
    // Update status to IN_PROGRESS
    await this.prisma.bloodRequest.update({
      where: { id: request.id },
      data: { status: 'IN_PROGRESS' },
    });

    // Fetch the requesting doctor's phone number for progress notifications
    const requester = await this.prisma.doctor.findUniqueOrThrow({
      where: { userId: request.requesterId },
      select: { phone: true },
    });

    // Build the context the agent prompts read via getRequestBlock()
    const bloodRequestContext: BloodRequestContext = {
      requestId: request.id,
      bloodGroup: request.bloodGroup,
      unitsRequired: request.unitsRequired,
      urgency: request.urgency,
      hospitalName: request.hospitalName,
      town: request.town,
      region: request.region,
      requiredBy: request.requiredBy.toISOString(),
      patientAge: request.patientAge,
      patientGender: request.patientGender,
      medicalReason: request.medicalReason ?? undefined,
      doctorPhone: requester.phone,
    };

    // The coordinator agent is injected directly via COORDINATOR_AGENT_TOKEN

    const message =
      `New blood request submitted.\n` +
      `Request ID: ${bloodRequestContext.requestId}\n` +
      `Blood Group: ${bloodRequestContext.bloodGroup}\n` +
      `Units Needed: ${bloodRequestContext.unitsRequired}\n` +
      `Urgency: ${bloodRequestContext.urgency}\n` +
      `Hospital: ${bloodRequestContext.hospitalName}, ${bloodRequestContext.town}, ${bloodRequestContext.region}\n` +
      `Required By: ${bloodRequestContext.requiredBy}\n` +
      (bloodRequestContext.medicalReason
        ? `Medical Reason: ${bloodRequestContext.medicalReason}\n`
        : '') +
      `\nPlease begin outreach immediately.`;

    this.logger.log(`Triggering coordinator for request ${request.id}`);

    await this.coordinator.generateText(message, {
      userId: request.id, // Use request ID as session identifier
      context: new Map<string | symbol, unknown>([
        ['bloodRequest', bloodRequestContext],
      ]),
    });

    this.logger.log(`Coordinator finished processing request ${request.id}`);
  }

  /**
   * Retrieves real-time progress count of positive responses for a blood request.
   */
  async getProgress(userId: string, requestId: string) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: requestId },
      include: {
        donorResponses: {
          include: { donor: true },
        },
        bloodBankResponses: {
          include: { bloodBank: true },
        },
      },
    });

    // Check if the request exists and belongs to the user
    if (!request || request.requesterId !== userId) {
      // NOTE: In a full access control model, Hospitals might be able to view requests of their Doctors too.
      // We assume strict requester control here for now.
      throw new NotFoundException(`Blood request not found`);
    }

    const eligibleDonors = request.donorResponses.filter(
      (dr) => dr.availability === 'AVAILABLE',
    ).length;

    const conditionalDonors = request.donorResponses.filter(
      (dr) => dr.availability === 'CONDITIONAL',
    ).length;

    const bloodBankSummary = request.bloodBankResponses
      .filter((bbr) => bbr.available)
      .map((bbr) => ({
        name: bbr.bloodBank.name,
        unitsAvailable: bbr.unitsAvailable,
      }));

    const totalUnitsFromBanks = bloodBankSummary.reduce(
      (sum, b) => sum + b.unitsAvailable,
      0,
    );

    return {
      status: request.status,
      eligibleDonors,
      conditionalDonors,
      totalUnitsFromBanks,
      bloodBanks: bloodBankSummary,
    };
  }

  // ========== NEW METHODS FOR DOCTOR HISTORY ==========

  /**
   * Get all blood requests made by a specific doctor with pagination and filtering
   */
  async getDoctorRequests(doctorId: string, page: number = 1, limit: number = 10, status?: string) {
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {
      requesterId: doctorId,
    };
    
    // Filter by status if provided
    if (status && status !== 'ALL') {
      where.status = status;
    }
    
    // Get total count for pagination
    const total = await this.prisma.bloodRequest.count({ where });
    
    // Get requests with related data
    const requests = await this.prisma.bloodRequest.findMany({
      where,
      include: {
        donorResponses: {
          select: {
            availability: true,
            donor: {
              select: {
                id: true,
                name: true,
                bloodGroup: true,
              },
            },
          },
        },
        bloodBankResponses: {
          select: {
            available: true,
            unitsAvailable: true,
            bloodBank: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });
    
    // Calculate summary stats for each request
    const enrichedRequests = requests.map(request => ({
      ...request,
      summary: {
        donorsContacted: request.donorResponses.length,
        donorsAvailable: request.donorResponses.filter(r => r.availability === 'AVAILABLE').length,
        bloodBanksContacted: request.bloodBankResponses.length,
        bloodBanksAvailable: request.bloodBankResponses.filter(r => r.available).length,
        hasFeedback: false,
      },
      // Format dates for easier display
      formattedDate: request.createdAt.toLocaleDateString(),
      formattedTime: request.createdAt.toLocaleTimeString(),
      timeAgo: this.getTimeAgo(request.createdAt),
    }));
    
    return {
      data: enrichedRequests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get a single blood request by ID with full details
   */
  async getDoctorRequestById(doctorId: string, requestId: string) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id: requestId },
      include: {
        donorResponses: {
          include: {
            donor: {
              select: {
                id: true,
                name: true,
                bloodGroup: true,
              },
            },
          },
        },
        bloodBankResponses: {
          include: {
            bloodBank: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found');
    }

    if (request.requesterId !== doctorId) {
      throw new ForbiddenException('You can only view your own requests');
    }

    // Calculate summary
    const summary = {
      donorsContacted: request.donorResponses.length,
      donorsAvailable: request.donorResponses.filter(r => r.availability === 'AVAILABLE').length,
      bloodBanksContacted: request.bloodBankResponses.length,
      bloodBanksAvailable: request.bloodBankResponses.filter(r => r.available).length,
    };

    return {
      ...request,
      summary,
    };
  }

  /**
   * Helper method to get time ago string
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }
}