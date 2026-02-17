import { Controller, Get, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import { InviteDoctorDto } from './dto/invite-doctor.dto';
import { UpdateHospitalProfileDto } from './dto/update-hospital-profile.dto';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUser as CurrentUserType,
} from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('hospitals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get('profile')
  @Roles(UserRole.HOSPITAL)
  async getProfile(@CurrentUser() user: CurrentUserType) {
    return this.hospitalsService.getProfile(user.userId);
  }

  @Patch('profile')
  @Roles(UserRole.HOSPITAL)
  async updateProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateHospitalProfileDto,
  ) {
    return this.hospitalsService.updateProfile(user.userId, dto);
  }

  @Post('donors')
  @Roles(UserRole.HOSPITAL)
  async registerDonor(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: RegisterDonorDto,
  ) {
    return this.hospitalsService.registerDonor(user.userId, dto);
  }

  @Post('invite-doctor')
  @Roles(UserRole.HOSPITAL)
  async inviteDoctor(
    @CurrentUser() user: CurrentUserType,
    @Body() inviteDoctorDto: InviteDoctorDto,
  ) {
    return this.hospitalsService.inviteDoctor(user.userId, inviteDoctorDto);
  }
}
