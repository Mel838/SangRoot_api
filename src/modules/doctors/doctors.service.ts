import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DonorsService } from '../donors/donors.service';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { RegisterDonorDto } from '../donors/dto/register-donor.dto';

@Injectable()
export class DoctorsService {
  constructor(
    private prisma: PrismaService,
    private donorsService: DonorsService, // ← injected
  ) {}

  async getProfile(userId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        phone: true,
        specialization: true,
        registrationNo: true,
        hospitalId: true,
        hospital: {
          select: { id: true, name: true, region: true, town: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!doctor) throw new NotFoundException('Doctor profile not found');

    return doctor;
  }

  async updateProfile(userId: string, dto: UpdateDoctorProfileDto) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });

    if (!doctor) throw new NotFoundException('Doctor profile not found');

    if (dto.registrationNo && dto.registrationNo !== doctor.registrationNo) {
      const existing = await this.prisma.doctor.findFirst({
        where: { registrationNo: dto.registrationNo },
      });
      if (existing) {
        throw new BadRequestException('Registration number already in use');
      }
    }

    return this.prisma.doctor.update({
      where: { userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.specialization !== undefined && {
          specialization: dto.specialization,
        }),
        ...(dto.registrationNo !== undefined && {
          registrationNo: dto.registrationNo,
        }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        specialization: true,
        registrationNo: true,
        hospitalId: true,
        hospital: {
          select: { id: true, name: true, region: true, town: true },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async registerDonor(userId: string, dto: RegisterDonorDto) {
    // 1. Resolve the doctor entity
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      include: { hospital: true },
    });

    if (!doctor) throw new NotFoundException('Doctor profile not found');
    if (!doctor.hospitalId) {
      throw new BadRequestException('Doctor is not associated with a hospital');
    }

    // 2. Delegate — phone check + create both happen inside DonorsService.
    //    ConflictException is thrown automatically if phone is taken.
    //    Doctors register donors under their hospital's ID.
    return this.donorsService.registerDonor(dto, {
      hospitalId: doctor.hospitalId,
    });
  }
}
