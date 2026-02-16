import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { RegisterDonorDto } from '../hospitals/dto/register-donor.dto';

@Injectable()
export class DoctorsService {
  constructor(private prisma: PrismaService) {}

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
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }
    return doctor;
  }

  async updateProfile(userId: string, dto: UpdateDoctorProfileDto) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }
    if (dto.registrationNo && dto.registrationNo !== doctor.registrationNo) {
      const existing = await this.prisma.doctor.findFirst({
        where: { registrationNo: dto.registrationNo },
      });
      if (existing) {
        throw new BadRequestException('Registration number already in use');
      }
    }
    const updated = await this.prisma.doctor.update({
      where: { userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.specialization !== undefined && { specialization: dto.specialization }),
        ...(dto.registrationNo !== undefined && { registrationNo: dto.registrationNo }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        specialization: true,
        registrationNo: true,
        hospitalId: true,
        hospital: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
    return updated;
  }

  async registerDonor(userId: string, dto: RegisterDonorDto) {
    // Get doctor and their hospital
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      include: { hospital: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    if (!doctor.hospitalId) {
      throw new BadRequestException('Doctor is not associated with a hospital');
    }

    // Check if donor with same phone already exists
    const existingDonor = await this.prisma.donor.findUnique({
      where: { phone: dto.phone },
    });

    if (existingDonor) {
      throw new BadRequestException('Donor with this phone number already registered');
    }

    // Create donor
    const donor = await this.prisma.donor.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        bloodGroup: dto.bloodGroup,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isAvailable: dto.isAvailable ?? true,
        hospitalId: doctor.hospitalId,
      },
    });

    return donor;
  }
}
