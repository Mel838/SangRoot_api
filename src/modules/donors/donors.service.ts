import { ConflictException, Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { DONOR_COORDINATOR_TOKEN } from '../../services/agents/voltagent.module';
import { Agent } from '@voltagent/core';
import { DonorCoordinatorContext } from '../../services/agents/donor-coordinator/prompts';

interface RegisteredBy {
  bloodBankId?: string;
  hospitalId?: string;
  doctorId?: string;
}

@Injectable()
export class DonorsService {
  private readonly logger = new Logger(DonorsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(DONOR_COORDINATOR_TOKEN) private readonly donorCoordinator: Agent,
  ) {}

  // ── Phone checks ──────────────────────────────────────────────────────────

  /** Exact match — used for the registration guard and check-phone endpoint */
  async checkPhoneExists(phone: string): Promise<boolean> {
    const donor = await this.prisma.donor.findUnique({
      where: { phone },
      select: { id: true },
    });
    return !!donor;
  }

  /**
   * Flexible match — strips non-numeric chars before comparing.
   * Catches cases where users type +237600... vs 00237600... vs 600...
   */
  async checkPhoneExistsFlexible(phone: string): Promise<boolean> {
    const cleanPhone = phone.replace(/\D/g, '');
    const donor = await this.prisma.donor.findFirst({
      where: {
        OR: [{ phone }, { phone: { contains: cleanPhone } }],
      },
      select: { id: true },
    });
    return !!donor;
  }

  // ── Core registration ─────────────────────────────────────────────────────

  /**
   * Single source of truth for donor creation.
   * Called by BloodBanksService, HospitalsService, and DoctorsService.
   *
   * @param dto          Validated registration payload
   * @param registeredBy Either { bloodBankId }, { hospitalId }, or { doctorId }
   *
   * Throws ConflictException (HTTP 409) if phone is already registered.
   * NestJS serialises this automatically — callers need no try/catch.
   */
  async registerDonor(dto: RegisterDonorDto, registeredBy: RegisteredBy) {
    const exists = await this.checkPhoneExists(dto.phone);
    if (exists) {
      throw new ConflictException(
        'A donor with this phone number already exists.',
      );
    }
    // Only runs if email was provided
    if (dto.email) {
      const emailExists = await this.prisma.donor.findFirst({
        where: { email: dto.email },
        select: { id: true },
      });
      if (emailExists) {
        throw new ConflictException(
          'A donor with this email address already exists.',
        );
      }
    }

    const donor = await this.prisma.donor.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        dateBirth: new Date(dto.dateBirth),
        bloodGroup: dto.bloodGroup,
        region: dto.region,
        town: dto.town,
        neighbourhood: dto.neighbourhood,
        genre: dto.genre,
        // Only one will be defined per caller
        ...(registeredBy.bloodBankId && {
          bloodBankId: registeredBy.bloodBankId,
        }),
        ...(registeredBy.hospitalId && { hospitalId: registeredBy.hospitalId }),
        ...(registeredBy.doctorId && { doctorId: registeredBy.doctorId }),
      },
    });

    // -----------------------------------------------------------------------
    // V2: Populate PhoneNumberRegistry
    // -----------------------------------------------------------------------
    const cleanPhone = donor.phone.replace(/\+/g, '').trim();
    await this.prisma.phoneNumberRegistry.upsert({
      where: { phone: cleanPhone },
      update: { entityId: donor.id, entityType: 'DONOR' },
      create: {
        phone: cleanPhone,
        entityId: donor.id,
        entityType: 'DONOR',
      },
    });

    // -----------------------------------------------------------------------
    // V2: Trigger Donor Coordinator for Onboarding
    // -----------------------------------------------------------------------
    const sessionKey = `donor:${donor.id}`;
    const donorContext: DonorCoordinatorContext = {
      trigger: 'ONBOARDING',
      entityType: 'DONOR',
      entityId: donor.id,
      entityName: donor.name,
      entityLanguage: 'FR', // Defaulting to French for Cameroon
    };

    this.logger.log(`Triggering onboarding for donor: ${sessionKey}`);

    this.donorCoordinator
      .generateText(
        `New donor registered: ${donor.name} (${donor.phone}). Start onboarding conversation.`,
        {
          memory: {
            userId: sessionKey,
            conversationId: `onboarding:${donor.id}`,
            options: { contextLimit: 30 },
          },
          context: new Map<string | symbol, unknown>([
            ['donorCoordinatorContext', donorContext],
          ]),
        },
      )
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.error(
          `Failed to trigger onboarding for ${sessionKey}: ${error.message}`,
        );
      });

    return donor;
  }
}
