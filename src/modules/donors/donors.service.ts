import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDonorDto } from './dto/register-donor.dto';

interface RegisteredBy {
  bloodBankId?: string;
  hospitalId?: string;
  doctorId?: string;
}

@Injectable()
export class DonorsService {
  constructor(private prisma: PrismaService) {}

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
   * @param registeredBy Either { bloodBankId } or { hospitalId }
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

    return this.prisma.donor.create({
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
  }
}
