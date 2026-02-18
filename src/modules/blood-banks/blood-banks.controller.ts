import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
	CurrentUser,
	type CurrentUser as CurrentUserType,
} from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { BloodBanksService } from "./blood-banks.service";
import type { RegisterDonorDto } from "./dto/register-donor.dto";
import type { UpdateBloodBankProfileDto } from "./dto/update-blood-bank-profile.dto";

@Controller("blood-banks")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BloodBanksController {
	constructor(private readonly bloodBanksService: BloodBanksService) {}

	@Get("profile")
	@Roles(UserRole.BLOOD_BANK)
	async getProfile(@CurrentUser() user: CurrentUserType) {
		return this.bloodBanksService.getProfile(user.userId);
	}

	@Patch("profile")
	@Roles(UserRole.BLOOD_BANK)
	async updateProfile(
		@CurrentUser() user: CurrentUserType,
		@Body() dto: UpdateBloodBankProfileDto,
	) {
		return this.bloodBanksService.updateProfile(user.userId, dto);
	}

	@Post("donors")
	@Roles(UserRole.BLOOD_BANK)
	async registerDonor(
		@CurrentUser() user: CurrentUserType,
		@Body() dto: RegisterDonorDto,
	) {
		return this.bloodBanksService.registerDonor(user.userId, dto);
	}
}
