import { Injectable, Inject, Logger } from '@nestjs/common';
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
}
