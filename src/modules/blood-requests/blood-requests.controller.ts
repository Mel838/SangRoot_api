import { Controller, Post, Body, UseGuards, Get, Param, Query, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
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
import { PrismaService } from '../../prisma/prisma.service';

@Controller('blood-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BloodRequestsController {
  constructor(
    private readonly bloodRequestsService: BloodRequestsService,
    private readonly prisma: PrismaService,
  ) {}

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

  /**
   * GET /blood-requests/:id/progress
   * Retrieves the real-time AI progress (donor & blood bank positive responses)
   */
  @Get(':id/progress')
  @Roles(UserRole.DOCTOR, UserRole.HOSPITAL)
  async getProgress(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ) {
    return this.bloodRequestsService.getProgress(user.userId, id);
  }

  // ========== NEW ENDPOINTS FOR DOCTOR HISTORY ==========

  /**
   * GET /blood-requests/my-requests
   * Get all blood requests made by the logged-in doctor
   */
  @Get('my-requests')
  @Roles(UserRole.DOCTOR)
  async getMyRequests(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
  ) {
    const doctorId = req.user.id;
    return this.bloodRequestsService.getDoctorRequests(doctorId, page, limit, status);
  }

  /**
   * GET /blood-requests/my-requests/:id
   * Get a specific blood request with full details
   */
  @Get('my-requests/:id')
  @Roles(UserRole.DOCTOR)
  async getMyRequestById(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const doctorId = req.user.id;
    
    const request = await this.bloodRequestsService.getDoctorRequestById(doctorId, id);
    
    // Check if feedback exists
    const feedback = await this.prisma.feedback.findUnique({
      where: { requestId: id },
      select: { id: true, overallRating: true, createdAt: true },
    });
    
    return {
      ...request,
      hasFeedback: !!feedback,
      feedback: feedback || null,
    };
  }
}