import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
	CurrentUser,
	type CurrentUser as CurrentUserType,
} from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { InviteDoctorDto } from "./dto/invite-doctor.dto";
import type { RegisterDonorDto } from "./dto/register-donor.dto";
import type { UpdateHospitalProfileDto } from "./dto/update-hospital-profile.dto";
import type { HospitalsService } from "./hospitals.service";

@Controller("hospitals")
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalsController {
	constructor(private readonly hospitalsService: HospitalsService) {}

	@Get("profile")
	@Roles(UserRole.HOSPITAL)
	async getProfile(@CurrentUser() user: CurrentUserType) {
		return this.hospitalsService.getProfile(user.userId);
	}

	@Patch("profile")
	@Roles(UserRole.HOSPITAL)
	async updateProfile(
		@CurrentUser() user: CurrentUserType,
		@Body() dto: UpdateHospitalProfileDto,
	) {
		return this.hospitalsService.updateProfile(user.userId, dto);
	}

	@Post("donors")
	@Roles(UserRole.HOSPITAL)
	async registerDonor(
		@CurrentUser() user: CurrentUserType,
		@Body() dto: RegisterDonorDto,
	) {
		return this.hospitalsService.registerDonor(user.userId, dto);
	}

	@Post("invite-doctor")
	@Roles(UserRole.HOSPITAL)
	async inviteDoctor(
		@CurrentUser() user: CurrentUserType,
		@Body() inviteDoctorDto: InviteDoctorDto,
	) {
		return this.hospitalsService.inviteDoctor(user.userId, inviteDoctorDto);
	}
}
