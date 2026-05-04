import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { DonorsService } from '../donors/donors.service';
import { InviteDoctorDto } from './dto/invite-doctor.dto';
import { UpdateHospitalProfileDto } from './dto/update-hospital-profile.dto';
import { RegisterDonorDto } from '../donors/dto/register-donor.dto';
import { UserRole, InviteStatus } from '@prisma/client';

@Injectable()
export class HospitalsService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private donorsService: DonorsService, // ← injected
  ) {}

  async getProfile(hospitalUserId: string) {
    const hospitalUser = await this.prisma.user.findUnique({
      where: { id: hospitalUserId },
      include: { hospital: true },
    });

    if (!hospitalUser) throw new NotFoundException('Hospital user not found');
    if (!hospitalUser.hospital)
      throw new NotFoundException('Hospital profile not found');

    return hospitalUser.hospital;
  }

  async updateProfile(hospitalUserId: string, dto: UpdateHospitalProfileDto) {
    const hospitalUser = await this.prisma.user.findUnique({
      where: { id: hospitalUserId },
      include: { hospital: true },
    });

    if (!hospitalUser) throw new NotFoundException('Hospital user not found');
    if (!hospitalUser.hospital)
      throw new NotFoundException('Hospital profile not found');

    return this.prisma.hospital.update({
      where: { id: hospitalUser.hospital.id },
      data: dto,
    });
  }

  async inviteDoctor(hospitalUserId: string, inviteDoctorDto: InviteDoctorDto) {
    const { doctorEmail } = inviteDoctorDto;

    const hospitalUser = await this.prisma.user.findUnique({
      where: { id: hospitalUserId },
      include: { hospital: true },
    });

    if (!hospitalUser) throw new NotFoundException('Hospital user not found');
    if (hospitalUser.role !== UserRole.HOSPITAL) {
      throw new ForbiddenException('Only hospitals can invite doctors');
    }
    if (!hospitalUser.hospital)
      throw new NotFoundException('Hospital profile not found');

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

    const invite = await this.prisma.hospitalInvite.create({
      data: {
        hospitalId: hospitalUser.hospital.id,
        doctorEmail: doctorEmail.toLowerCase(),
        status: InviteStatus.PENDING,
        invitedBy: hospitalUserId,
      },
    });

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
    // 1. Resolve the hospital entity
    const hospitalUser = await this.prisma.user.findUnique({
      where: { id: hospitalUserId },
      include: { hospital: true },
    });

    if (!hospitalUser) throw new NotFoundException('Hospital user not found');
    if (!hospitalUser.hospital)
      throw new NotFoundException('Hospital profile not found');

    // 2. Delegate — phone check + create both happen inside DonorsService.
    //    ConflictException is thrown automatically if phone is taken.
    return this.donorsService.registerDonor(dto, {
      hospitalId: hospitalUser.hospital.id,
    });
  }

  async getStats(hospitalUserId: string) {
    const hospitalUser = await this.prisma.user.findUnique({
      where: { id: hospitalUserId },
      include: { hospital: true },
    });

    if (!hospitalUser) throw new NotFoundException('Hospital user not found');
    if (!hospitalUser.hospital)
      throw new NotFoundException('Hospital profile not found');

    const hospitalId = hospitalUser.hospital.id;

    const [doctorsCount, donorsCount, requestsCount] = await Promise.all([
      this.prisma.doctor.count({ where: { hospitalId } }),
      this.prisma.donor.count({ where: { hospitalId } }),
      this.prisma.bloodRequest.count({
        where: { requesterId: hospitalUserId },
      }),
    ]);

    return {
      doctors: doctorsCount,
      donors: donorsCount,
      requests: requestsCount,
    };
  }
}
