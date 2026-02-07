import { Controller, Get, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { BloodBanksService } from './blood-banks.service';
import { UpdateBloodBankProfileDto } from './dto/update-blood-bank-profile.dto';
import { RegisterDonorDto } from './dto/register-donor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUser as CurrentUserType } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('blood-banks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BloodBanksController {
  constructor(private readonly bloodBanksService: BloodBanksService) {}

  @Get('profile')
  @Roles(UserRole.BLOOD_BANK)
  async getProfile(@CurrentUser() user: CurrentUserType) {
    return this.bloodBanksService.getProfile(user.userId);
  }

  @Patch('profile')
  @Roles(UserRole.BLOOD_BANK)
  async updateProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateBloodBankProfileDto,
  ) {
    return this.bloodBanksService.updateProfile(user.userId, dto);
  }

  @Post('donors')
  @Roles(UserRole.BLOOD_BANK)
  async registerDonor(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: RegisterDonorDto,
  ) {
    return this.bloodBanksService.registerDonor(user.userId, dto);
  }
}
