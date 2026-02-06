import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InviteDoctorDto } from './dto/invite-doctor.dto';
import { UserRole, InviteStatus } from '@prisma/client';

@Injectable()
export class HospitalsService {
  constructor(private prisma: PrismaService) {}

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
        throw new BadRequestException('Doctor has already been invited and accepted');
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

    return {
      id: invite.id,
      doctorEmail: invite.doctorEmail,
      status: invite.status,
      createdAt: invite.createdAt,
    };
  }
}
