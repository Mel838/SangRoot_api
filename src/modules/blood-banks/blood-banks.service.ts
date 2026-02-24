import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateBloodBankProfileDto } from './dto/update-blood-bank-profile.dto';
import { RegisterDonorDto } from '../hospitals/dto/register-donor.dto';

@Injectable()
export class BloodBanksService {
  constructor(private prisma: PrismaService) {}

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

    const updated = await this.prisma.bloodBank.update({
      where: { userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.region !== undefined && { region: dto.region }), // ← replaces state
        ...(dto.town !== undefined && { town: dto.town }), // ← replaces city
        ...(dto.neighbourhood !== undefined && {
          neighbourhood: dto.neighbourhood,
        }), // ← replaces pincode
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

    return updated;
  }

  async registerDonor(bloodBankUserId: string, dto: RegisterDonorDto) {
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

    const existingDonor = await this.prisma.donor.findUnique({
      where: { phone: dto.phone },
    });

    if (existingDonor) {
      throw new BadRequestException(
        'Donor with this phone number already registered',
      );
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
        bloodBankId: bloodBankUser.bloodBank.id,
      },
    });

    return donor;
  }
}
