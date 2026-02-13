import { Controller, Get, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { RegisterDonorDto } from '../hospitals/dto/register-donor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUser as CurrentUserType } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get('profile')
  @Roles(UserRole.DOCTOR)
  async getProfile(@CurrentUser() user: CurrentUserType) {
    return this.doctorsService.getProfile(user.userId);
  }

  @Patch('profile')
  @Roles(UserRole.DOCTOR)
  async updateProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateDoctorProfileDto,
  ) {
    return this.doctorsService.updateProfile(user.userId, dto);
  }

  @Post('donors')
  @Roles(UserRole.DOCTOR)
  async registerDonor(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: RegisterDonorDto,
  ) {
    return this.doctorsService.registerDonor(user.userId, dto);
  }
}
