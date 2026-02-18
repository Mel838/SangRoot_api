import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RegisterDonorDto } from "./dto/register-donor.dto";
import type { UpdateBloodBankProfileDto } from "./dto/update-blood-bank-profile.dto";

@Injectable()
export class BloodBanksService {
	constructor(private prisma: PrismaService) {}

	async getProfile(userId: string) {
		const bloodBank = await this.prisma.bloodBank.findUnique({
			where: { userId },
			select: {
				id: true,
				name: true,
				address: true,
				city: true,
				state: true,
				pincode: true,
				phone: true,
				latitude: true,
				longitude: true,
				licenseNumber: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		if (!bloodBank) {
			throw new NotFoundException("Blood bank profile not found");
		}
		return bloodBank;
	}

	async updateProfile(userId: string, dto: UpdateBloodBankProfileDto) {
		const bloodBank = await this.prisma.bloodBank.findUnique({
			where: { userId },
		});
		if (!bloodBank) {
			throw new NotFoundException("Blood bank profile not found");
		}
		if (dto.licenseNumber && dto.licenseNumber !== bloodBank.licenseNumber) {
			const other = await this.prisma.bloodBank.findFirst({
				where: { licenseNumber: dto.licenseNumber, id: { not: bloodBank.id } },
			});
			if (other) {
				throw new BadRequestException("License number already in use");
			}
		}
		const updated = await this.prisma.bloodBank.update({
			where: { userId },
			data: {
				...(dto.name !== undefined && { name: dto.name }),
				...(dto.address !== undefined && { address: dto.address }),
				...(dto.city !== undefined && { city: dto.city }),
				...(dto.state !== undefined && { state: dto.state }),
				...(dto.pincode !== undefined && { pincode: dto.pincode }),
				...(dto.phone !== undefined && { phone: dto.phone }),
				...(dto.latitude !== undefined && { latitude: dto.latitude }),
				...(dto.longitude !== undefined && { longitude: dto.longitude }),
				...(dto.licenseNumber !== undefined && {
					licenseNumber: dto.licenseNumber,
				}),
			},
			select: {
				id: true,
				name: true,
				address: true,
				city: true,
				state: true,
				pincode: true,
				phone: true,
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
		// Get blood bank user
		const bloodBankUser = await this.prisma.user.findUnique({
			where: { id: bloodBankUserId },
			include: { bloodBank: true },
		});

		if (!bloodBankUser) {
			throw new NotFoundException("Blood bank user not found");
		}

		if (!bloodBankUser.bloodBank) {
			throw new NotFoundException("Blood bank profile not found");
		}

		// Check if donor with same phone already exists
		const existingDonor = await this.prisma.donor.findUnique({
			where: { phone: dto.phone },
		});

		if (existingDonor) {
			throw new BadRequestException(
				"Donor with this phone number already registered",
			);
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
				bloodBankId: bloodBankUser.bloodBank.id,
			},
		});

		return donor;
	}
}
