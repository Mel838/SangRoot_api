import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent, Memory, ModelProviderRegistry } from '@voltagent/core';
import { PostgreSQLMemoryAdapter } from '@voltagent/postgres';
import {
  COORDINATOR_PROMPT,
  DONOR_OUTREACH_PROMPT,
  BLOOD_BANK_LIAISON_PROMPT,
  ELIGIBILITY_PROMPT,
  RESULT_REPORT_PROMPT,
} from './prompts';
import {
  sendWhatsAppMessage,
  recordDonorConsent,
  emitDoctorSummary,
} from './tools';

@Injectable()
export class AgentsService implements OnModuleInit {
  private readonly logger = new Logger(AgentsService.name);
  private sangrootAgent: Agent;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    try {
      // Stop the auto-refresh loop to prevent network timeout errors
      // caused by ModelProviderRegistry trying to reach models.dev
      ModelProviderRegistry.getInstance().stopAutoRefresh();
    } catch (error) {
      this.logger.warn(
        'Failed to stop ModelProviderRegistry auto-refresh',
        error,
      );
    }
    this.initializeAgents();
  }

  private initializeAgents() {
    const databaseUrl = this.configService.get<string>(
      'DATABASE_URL',
      'postgresql://localhost:5432/sangroot_worker',
    );

    const sharedMemory = new Memory({
      storage: new PostgreSQLMemoryAdapter({
        connection: databaseUrl,
        tablePrefix: 'sangroot_memory',
      }),
    });

    const donorOutreachAgent = new Agent({
      name: 'donor-outreach-agent',
      instructions: DONOR_OUTREACH_PROMPT,
      model: 'openai/gpt-4o-mini',
      memory: sharedMemory,
      tools: [sendWhatsAppMessage, recordDonorConsent],
    });

    const bloodBankAgent = new Agent({
      name: 'blood-bank-liaison-agent',
      instructions: BLOOD_BANK_LIAISON_PROMPT,
      model: 'openai/gpt-4o-mini',
      memory: sharedMemory,
      tools: [sendWhatsAppMessage],
    });

    const eligibilityAgent = new Agent({
      name: 'eligibility-agent',
      instructions: ELIGIBILITY_PROMPT,
      model: 'openai/gpt-4o-mini',
      memory: sharedMemory,
    });

    const resultAgent = new Agent({
      name: 'result-reporting-agent',
      instructions: RESULT_REPORT_PROMPT,
      model: 'openai/gpt-4o-mini',
      memory: sharedMemory,
      tools: [emitDoctorSummary],
    });

    this.sangrootAgent = new Agent({
      name: 'sangroot-coordinator',
      instructions: COORDINATOR_PROMPT,
      model: 'openai/gpt-4o-mini',
      memory: sharedMemory,
      subAgents: [
        donorOutreachAgent,
        bloodBankAgent,
        eligibilityAgent,
        resultAgent,
      ],
    });

    this.logger.log('SangRoot Agents initialized successfully.');
  }

  public getCoordinatorAgent(): Agent {
    return this.sangrootAgent;
  }
}
