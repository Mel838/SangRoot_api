import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DonorsService } from '../donors/donors.service';
import { UpdateBloodBankProfileDto } from './dto/update-blood-bank-profile.dto';
import { RegisterDonorDto } from '../donors/dto/register-donor.dto';

@Injectable()
export class BloodBanksService {
  constructor(
    private prisma: PrismaService,
    private donorsService: DonorsService, // ← injected
  ) {}

  async getProfile(userId: string) {
    const bloodBank = await this.prisma.bloodBank.findUnique({
      where: { userId },
      select: {
        id: true,
        name: true,
        phone: true,
        region: true,
        town: true,
        neighbourhood: true,
        address: true,
        latitude: true,
        longitude: true,
        licenseNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!bloodBank) {
      throw new NotFoundException('Blood bank profile not found');
    }

    return bloodBank;
  }

  async updateProfile(userId: string, dto: UpdateBloodBankProfileDto) {
    const bloodBank = await this.prisma.bloodBank.findUnique({
      where: { userId },
    });

    if (!bloodBank) {
      throw new NotFoundException('Blood bank profile not found');
    }

    if (dto.licenseNumber && dto.licenseNumber !== bloodBank.licenseNumber) {
      const other = await this.prisma.bloodBank.findFirst({
        where: { licenseNumber: dto.licenseNumber, id: { not: bloodBank.id } },
      });
      if (other) {
        throw new BadRequestException('License number already in use');
      }
    }

    return this.prisma.bloodBank.update({
      where: { userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.region !== undefined && { region: dto.region }),
        ...(dto.town !== undefined && { town: dto.town }),
        ...(dto.neighbourhood !== undefined && {
          neighbourhood: dto.neighbourhood,
        }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.licenseNumber !== undefined && {
          licenseNumber: dto.licenseNumber,
        }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        region: true,
        town: true,
        neighbourhood: true,
        address: true,
        latitude: true,
        longitude: true,
        licenseNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async registerDonor(bloodBankUserId: string, dto: RegisterDonorDto) {
    // 1. Resolve the blood bank entity
    const bloodBankUser = await this.prisma.user.findUnique({
      where: { id: bloodBankUserId },
      include: { bloodBank: true },
    });

    if (!bloodBankUser) {
      throw new NotFoundException('Blood bank user not found');
    }
    if (!bloodBankUser.bloodBank) {
      throw new NotFoundException('Blood bank profile not found');
    }

    // 2. Delegate — phone check + create both happen inside DonorsService.
    //    ConflictException is thrown automatically if phone is taken.
    return this.donorsService.registerDonor(dto, {
      bloodBankId: bloodBankUser.bloodBank.id,
    });
  }
}
