import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { InviteDoctorDto } from './dto/invite-doctor.dto';
import { UpdateHospitalProfileDto } from './dto/update-hospital-profile.dto';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { UserRole, InviteStatus } from '@prisma/client';

@Injectable()
export class HospitalsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async getProfile(hospitalUserId: string) {
    const hospitalUser = await this.prisma.user.findUnique({
      where: { id: hospitalUserId },
      include: { hospital: true },
    });

    if (!hospitalUser) {
      throw new NotFoundException('Hospital user not found');
    }

    if (!hospitalUser.hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    return hospitalUser.hospital;
  }

  async updateProfile(hospitalUserId: string, dto: UpdateHospitalProfileDto) {
    const hospitalUser = await this.prisma.user.findUnique({
      where: { id: hospitalUserId },
      include: { hospital: true },
    });

    if (!hospitalUser) {
      throw new NotFoundException('Hospital user not found');
    }

    if (!hospitalUser.hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    return this.prisma.hospital.update({
      where: { id: hospitalUser.hospital.id },
      data: dto,
    });
  }

  async inviteDoctor(hospitalUserId: string, inviteDoctorDto: InviteDoctorDto) {
    const { doctorEmail } = inviteDoctorDto;

    // Get hospital user
    const hospitalUser = await this.prisma.user.findUnique({
      where: { id: hospitalUserId },
      include: { hospital: true },
    });

    if (!hospitalUser) {
      throw new NotFoundException('Hospital user not found');
    }

    if (hospitalUser.role !== UserRole.HOSPITAL) {
      throw new ForbiddenException('Only hospitals can invite doctors');
    }

    if (!hospitalUser.hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    // Check if invite already exists
    const existingInvite = await this.prisma.hospitalInvite.findUnique({
      where: {
        hospitalId_doctorEmail: {
          hospitalId: hospitalUser.hospital.id,
          doctorEmail: doctorEmail.toLowerCase(),
        },
      },
    });

    if (existingInvite) {
      if (existingInvite.status === InviteStatus.PENDING) {
        throw new BadRequestException('Invite already sent to this email');
      }
      if (existingInvite.status === InviteStatus.ACCEPTED) {
        throw new BadRequestException(
          'Doctor has already been invited and accepted',
        );
      }
    }

    // Create invite
    const invite = await this.prisma.hospitalInvite.create({
      data: {
        hospitalId: hospitalUser.hospital.id,
        doctorEmail: doctorEmail.toLowerCase(),
        status: InviteStatus.PENDING,
        invitedBy: hospitalUserId,
      },
    });

    // Send invite email to the doctor
    await this.mailService.sendDoctorInvite(
      invite.doctorEmail,
      invite.id,
      hospitalUser.hospital.name || 'the hospital',
    );

    return {
      id: invite.id,
      doctorEmail: invite.doctorEmail,
      status: invite.status,
      createdAt: invite.createdAt,
    };
  }

  async registerDonor(hospitalUserId: string, dto: RegisterDonorDto) {
    // Get hospital user
    const hospitalUser = await this.prisma.user.findUnique({
      where: { id: hospitalUserId },
      include: { hospital: true },
    });

    if (!hospitalUser) {
      throw new NotFoundException('Hospital user not found');
    }

    if (!hospitalUser.hospital) {
      throw new NotFoundException('Hospital profile not found');
    }

    // Check if donor with same phone already exists
    const existingDonor = await this.prisma.donor.findUnique({
      where: { phone: dto.phone },
    });

    if (existingDonor) {
      throw new BadRequestException(
        'Donor with this phone number already registered',
      );
    }

    // Create donor
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
        hospitalId: hospitalUser.hospital.id,
      },
    });

    return donor;
  }
}
