import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import type { Agent } from '@voltagent/core';
import { DOCTOR_COORDINATOR_TOKEN } from '../../services/agents/voltagent.module';
import { DoctorCoordinatorContext } from '../../services/agents/doctor-coordinator/prompts';

@Injectable()
export class BloodRequestsService {
  private readonly logger = new Logger(BloodRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOCTOR_COORDINATOR_TOKEN) private readonly coordinator: Agent,
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
    createdAt: Date;
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

    // Build the context for the Doctor Coordinator
    const doctorContext: DoctorCoordinatorContext = {
      requestId: request.id,
      bloodGroup: request.bloodGroup,
      unitsNeeded: request.unitsRequired,
      urgency: request.urgency as 'ROUTINE' | 'URGENT' | 'CRITICAL',
      hospitalName: request.hospitalName,
      region: request.region,
      town: request.town,
      doctorPhone: requester.phone,
      doctorLanguage: 'FR', // Defaulting to French
      submittedAt: request.createdAt.toISOString(),
    };

    const message =
      `New blood request submitted.\n` +
      `Request ID: ${doctorContext.requestId}\n` +
      `Blood Group: ${doctorContext.bloodGroup}\n` +
      `Units Needed: ${doctorContext.unitsNeeded}\n` +
      `Urgency: ${doctorContext.urgency}\n` +
      `Hospital: ${doctorContext.hospitalName}, ${doctorContext.town}, ${doctorContext.region}\n` +
      `\nPlease begin outreach immediately.`;

    this.logger.log(`Triggering Doctor Coordinator for request ${request.id}`);

    const startedAt = Date.now();

    try {
      await this.coordinator.generateText(message, {
        memory: {
          userId: request.id,
          conversationId: request.id,
          options: { contextLimit: 50 },
        },
        context: new Map<string | symbol, unknown>([
          ['doctorCoordinatorContext', doctorContext],
        ]),
      });

      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      this.logger.log(
        `✅ Doctor Coordinator DONE — request ${request.id} | elapsed: ${elapsedSec}s`,
      );

      // Safety-net: if the agent finished but never persisted a final report
      // (e.g. it timed out mid-workflow), make sure the doctor is not left
      // waiting silently.
      const finalRequest = await this.prisma.bloodRequest.findUnique({
        where: { id: request.id },
        select: { reportMarkdown: true, status: true },
      });

      if (!finalRequest?.reportMarkdown) {
        this.logger.warn(
          `⚠️  No final report found for request ${request.id} after agent completion. Sending fallback notification.`,
        );
        await this.sendFallbackNotification(
          doctorContext.doctorPhone,
          doctorContext.doctorLanguage,
          request.id,
        );
      }
    } catch (err) {
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `❌ Doctor Coordinator FAILED — request ${request.id} | elapsed: ${elapsedSec}s | error: ${msg}`,
      );
      // Notify the doctor so they can take manual action
      await this.sendFallbackNotification(
        doctorContext.doctorPhone,
        doctorContext.doctorLanguage,
        request.id,
      ).catch(() => {
        /* best-effort */
      });
      throw err;
    }
  }

  /**
   * Sends a fallback WhatsApp message to the doctor when the agent finishes
   * without producing a final report, or crashes entirely.
   */
  private async sendFallbackNotification(
    doctorPhone: string,
    language: 'FR' | 'EN',
    requestId: string,
  ) {
    const apiToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
    if (!apiToken || !phoneNumberId) return;

    const body =
      language === 'EN'
        ? `SangRoot: The outreach process for your blood request (${requestId.slice(0, 8)}…) has completed. Please check the app for the latest status.`
        : `SangRoot: Le processus de recherche pour votre demande de sang (${requestId.slice(0, 8)}…) est terminé. Veuillez vérifier l'application pour le statut actuel.`;

    const to = doctorPhone.replace(/\+/g, '').trim();
    try {
      await fetch(
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
            to,
            type: 'text',
            text: { preview_url: false, body },
          }),
        },
      );
      this.logger.log(`Fallback notification sent to doctor (${to})`);
    } catch (err) {
      this.logger.warn(`Could not send fallback notification: ${String(err)}`);
    }
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
}
