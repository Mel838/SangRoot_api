import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InternalAgentsService } from './internal-agents.service';
import { AgentKeyGuard } from './agent-key.guard';
import { RecordDonorResponseDto } from './dto/record-donor-response.dto';
import { RecordBloodBankResponseDto } from './dto/record-blood-bank-response.dto';
import { FinalReportDto } from './dto/final-report.dto';

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

  /**
   * GET /internal/agents/donors?bloodGroup=A_POSITIVE&town=Yaounde&region=CENTRE
   * Returns donors matching the blood group and location.
   */
  @Get('donors')
  async getMatchingDonors(
    @Query('bloodGroup') bloodGroup: string,
    @Query('town') town: string,
    @Query('region') region: string,
  ) {
    return this.agentsService.getMatchingDonors(bloodGroup, town, region);
  }

  /**
   * GET /internal/agents/blood-banks?town=Yaounde&region=CENTRE
   * Returns blood banks in the specified town and region.
   */
  @Get('blood-banks')
  async getNearbyBloodBanks(
    @Query('town') town: string,
    @Query('region') region: string,
  ) {
    return this.agentsService.getNearbyBloodBanks(town, region);
  }

  /**
   * POST /internal/agents/donor-responses
   * Records a donor's response to outreach for a blood request.
   */
  @Post('donor-responses')
  async recordDonorResponse(@Body() dto: RecordDonorResponseDto) {
    return this.agentsService.recordDonorResponse(dto);
  }

  /**
   * POST /internal/agents/blood-bank-responses
   * Records a blood bank's availability response for a blood request.
   */
  @Post('blood-bank-responses')
  async recordBloodBankResponse(@Body() dto: RecordBloodBankResponseDto) {
    return this.agentsService.recordBloodBankResponse(dto);
  }

  /**
   * GET /internal/agents/eligibility-summary/:requestId
   * Returns the eligibility-filtered summary for a blood request.
   */
  @Get('eligibility-summary/:requestId')
  async getEligibilitySummary(
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.agentsService.getEligibilitySummary(requestId);
  }

  /**
   * POST /internal/agents/final-report
   * Saves the agent's final report and updates the BloodRequest status.
   */
  @Post('final-report')
  async persistFinalReport(@Body() dto: FinalReportDto) {
    return this.agentsService.persistFinalReport(dto);
  }
}
