import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BloodRequestsService } from './blood-requests.service';
import { CreateBloodRequestDto } from './dto/create-blood-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUser as CurrentUserType,
} from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('blood-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BloodRequestsController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  /**
   * POST /blood-requests
   * Creates a new blood request and triggers the AI agent coordinator.
   * Only accessible by authenticated doctors.
   */
  @Post()
  @Roles(UserRole.DOCTOR)
  async create(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: CreateBloodRequestDto,
  ) {
    return this.bloodRequestsService.create(user.userId, dto);
  }
}
