import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { InternalAgentsService } from './internal-agents.service';
import { AgentKeyGuard } from './agent-key.guard';
import { RecordDonorResponseDto } from './dto/record-donor-response.dto';
import { RecordBloodBankResponseDto } from './dto/record-blood-bank-response.dto';
import { FinalReportDto } from './dto/final-report.dto';
import { CreateOutreachTaskDto } from './dto/create-outreach-task.dto';
import { UpdateDonorProfileV2Dto } from './dto/update-donor-profile-v2.dto';
import { UpdateBloodBankProfileV2Dto } from './dto/update-blood-bank-profile-v2.dto';
import { AppendConversationDto } from './dto/append-conversation.dto';
import { DoctorCoordinatorCallbackDto } from './dto/doctor-coordinator-callback.dto';

/**
 * InternalAgentsController
 *
 * All routes are prefixed /internal/agents and protected by AgentKeyGuard
 * (x-agent-key header). These endpoints are only called by VoltAgent tools —
 * they are NOT part of the public API.
 */
@Controller('internal/agents')
@UseGuards(AgentKeyGuard)
export class InternalAgentsController {
  constructor(private readonly agentsService: InternalAgentsService) {}

  // ---------------------------------------------------------------------------
  // V2 — OUTREACH TASKS
  // ---------------------------------------------------------------------------

  @Post('outreach-tasks')
  async createOutreachTask(@Body() dto: CreateOutreachTaskDto) {
    return this.agentsService.createOutreachTask(dto);
  }

  @Get('outreach-progress/:requestId')
  async getOutreachProgress(
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.agentsService.getOutreachProgress(requestId);
  }

  // ---------------------------------------------------------------------------
  // V2 — DONOR MANAGEMENT
  // ---------------------------------------------------------------------------

  @Get('donors/matching')
  async getMatchingDonorsV2(
    @Query('bloodGroup') bloodGroup: string,
    @Query('region') region: string,
    @Query('excludeCooldown', new ParseBoolPipe({ optional: true }))
    excludeCooldown?: boolean,
    @Query('excludeOptOut', new ParseBoolPipe({ optional: true }))
    excludeOptOut?: boolean,
  ) {
    return this.agentsService.getMatchingDonorsV2(
      bloodGroup,
      region,
      excludeCooldown ?? true,
      excludeOptOut ?? true,
    );
  }

  @Get('donors/:donorId/profile')
  async getDonorProfile(@Param('donorId', ParseUUIDPipe) donorId: string) {
    return this.agentsService.getDonorProfile(donorId);
  }

  @Patch('donors/:donorId/profile')
  async updateDonorProfileV2(
    @Param('donorId', ParseUUIDPipe) donorId: string,
    @Body() dto: UpdateDonorProfileV2Dto,
  ) {
    return this.agentsService.updateDonorProfileV2(donorId, dto);
  }

  @Get('donors/:donorId/eligibility')
  async checkDonorEligibility(
    @Param('donorId', ParseUUIDPipe) donorId: string,
  ) {
    return this.agentsService.checkDonorEligibility(donorId);
  }

  @Patch('donors/:donorId/opt-out')
  async flagDonorOptOut(@Param('donorId', ParseUUIDPipe) donorId: string) {
    return this.agentsService.flagDonorOptOut(donorId);
  }

  // ---------------------------------------------------------------------------
  // V2 — BLOOD BANK MANAGEMENT
  // ---------------------------------------------------------------------------

  @Get('blood-banks/:bankId/profile')
  async getBloodBankProfile(@Param('bankId', ParseUUIDPipe) bankId: string) {
    return this.agentsService.getBloodBankProfile(bankId);
  }

  @Patch('blood-banks/:bankId/profile')
  async updateBloodBankProfileV2(
    @Param('bankId', ParseUUIDPipe) bankId: string,
    @Body() dto: UpdateBloodBankProfileV2Dto,
  ) {
    return this.agentsService.updateBloodBankProfileV2(bankId, dto);
  }

  // ---------------------------------------------------------------------------
  // V2 — CONVERSATION MANAGEMENT
  // ---------------------------------------------------------------------------

  @Post('conversations')
  async appendConversation(@Body() dto: AppendConversationDto) {
    return this.agentsService.appendConversation(dto);
  }

  // ---------------------------------------------------------------------------
  // V2 — SENDER RESOLUTION & ROUTING
  // ---------------------------------------------------------------------------

  @Get('resolve-sender/:phone')
  async resolveSenderIdentity(@Param('phone') phone: string) {
    return this.agentsService.resolveSenderIdentity(phone);
  }

  @Get('active-request/:entityId')
  async getActiveRequestForEntity(
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Query('entityType') entityType: string,
  ) {
    return this.agentsService.getActiveRequestForEntity(entityId, entityType);
  }

  @Post('doctor-coordinator/callbacks')
  handleDoctorCoordinatorCallback(@Body() dto: DoctorCoordinatorCallbackDto) {
    return this.agentsService.handleDoctorCoordinatorCallback(dto);
  }

  // ---------------------------------------------------------------------------
  // V2 — MISC
  // ---------------------------------------------------------------------------

  @Get('regional-alternatives')
  async getRegionalAlternatives(
    @Query('region') region: string,
    @Query('bloodGroup') bloodGroup: string,
  ) {
    return this.agentsService.getRegionalAlternatives(region, bloodGroup);
  }

  @Patch('blood-requests/:requestId/status')
  async updateBloodRequestStatus(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Query('status') status: string,
  ) {
    return this.agentsService.updateBloodRequestStatus(requestId, status);
  }

  // ---------------------------------------------------------------------------
  // ORIGINAL ENDPOINTS (preserved)
  // ---------------------------------------------------------------------------

  @Get('donors')
  async getMatchingDonors(
    @Query('bloodGroup') bloodGroup: string,
    @Query('town') town: string,
    @Query('region') region: string,
  ) {
    return this.agentsService.getMatchingDonors(bloodGroup, town, region);
  }

  @Get('blood-banks')
  async getNearbyBloodBanks(
    @Query('town') town: string,
    @Query('region') region: string,
  ) {
    return this.agentsService.getNearbyBloodBanks(town, region);
  }

  @Post('donor-responses')
  async recordDonorResponse(@Body() dto: RecordDonorResponseDto) {
    return this.agentsService.recordDonorResponse(dto);
  }

  @Post('blood-bank-responses')
  async recordBloodBankResponse(@Body() dto: RecordBloodBankResponseDto) {
    return this.agentsService.recordBloodBankResponse(dto);
  }

  @Get('eligibility-summary/:requestId')
  async getEligibilitySummary(
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.agentsService.getEligibilitySummary(requestId);
  }

  @Post('final-report')
  async persistFinalReport(@Body() dto: FinalReportDto) {
    return this.agentsService.persistFinalReport(dto);
  }
}
