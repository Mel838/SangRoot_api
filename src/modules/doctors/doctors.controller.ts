import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
	CurrentUser,
	type CurrentUser as CurrentUserType,
} from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { RegisterDonorDto } from "../hospitals/dto/register-donor.dto";
import type { DoctorsService } from "./doctors.service";
import type { UpdateDoctorProfileDto } from "./dto/update-doctor-profile.dto";

@Controller("doctors")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorsController {
	constructor(private readonly doctorsService: DoctorsService) {}

	@Get("profile")
	@Roles(UserRole.DOCTOR)
	async getProfile(@CurrentUser() user: CurrentUserType) {
		return this.doctorsService.getProfile(user.userId);
	}

	@Patch("profile")
	@Roles(UserRole.DOCTOR)
	async updateProfile(
		@CurrentUser() user: CurrentUserType,
		@Body() dto: UpdateDoctorProfileDto,
	) {
		return this.doctorsService.updateProfile(user.userId, dto);
	}

	@Post("donors")
	@Roles(UserRole.DOCTOR)
	async registerDonor(
		@CurrentUser() user: CurrentUserType,
		@Body() dto: RegisterDonorDto,
	) {
		return this.doctorsService.registerDonor(user.userId, dto);
	}
}
