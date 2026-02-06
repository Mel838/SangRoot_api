import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import { InviteDoctorDto } from './dto/invite-doctor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUser as CurrentUserType } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('hospitals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Post('invite-doctor')
  @Roles(UserRole.HOSPITAL)
  async inviteDoctor(
    @CurrentUser() user: CurrentUserType,
    @Body() inviteDoctorDto: InviteDoctorDto,
  ) {
    return this.hospitalsService.inviteDoctor(user.userId, inviteDoctorDto);
  }
}
