import { Agent, Memory } from '@voltagent/core';
import { PostgreSQLMemoryAdapter } from '@voltagent/postgres';
import { ConfigService } from '@nestjs/config';
import {
  getCoordinatorAgentInstructions,
  getDonorOutreachAgentInstructions,
  getBloodBankLiaisonAgentInstructions,
  getEligibilityTimingAgentInstructions,
  getResultReportingAgentInstructions,
} from './prompts';
import {
  donorOutreachAgentTools,
  bloodBankLiaisonAgentTools,
  eligibilityTimingAgentTools,
  resultReportingAgentTools,
} from './tools';

/**
 * Creates the coordinator agent (and all sub-agents) using NestJS ConfigService.
 *
 * This is a factory function — called inside VoltAgentModule's useFactory —
 * so ConfigService has already loaded all env vars from .env before this runs.
 * This matches the pattern used in PrismaService and AuthModule.
 */
export function createCoordinatorAgent(config: ConfigService): Agent {
  const host = config.get<string>('DB_HOST');
  const port = config.get<number>('DB_PORT') ?? 5432;
  const user = config.get<string>('DB_USERNAME');
  const password = config.get<string>('DB_PASSWORD');
  const database = config.get<string>('DB_NAME');
  const rejectUnauthorized =
    config.get<string>('DB_SSL_REJECT_UNAUTHORIZED') === 'true';

  if (!host || !user || !password || !database) {
    throw new Error(
      '[VoltAgent] Missing required PostgreSQL env variables: DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME',
    );
  }

  const sharedMemory = new Memory({
    storage: new PostgreSQLMemoryAdapter({
      connection: {
        host,
        port: typeof port === 'string' ? parseInt(port, 10) : port,
        user,
        password,
        database,
        ssl: { rejectUnauthorized },
      },
      tablePrefix: 'sangroot_agent_memory',
    }),
  });

  // ---------------------------------------------------------------------------
  // Sub-Agent: Donor Outreach
  // ---------------------------------------------------------------------------
  const donorOutreachAgent = new Agent({
    name: 'donor-outreach-agent',
    instructions: getDonorOutreachAgentInstructions,
    model: 'openai/gpt-4o-mini',
    tools: donorOutreachAgentTools,
    memory: sharedMemory,
    maxSteps: 20,
  });

  // ---------------------------------------------------------------------------
  // Sub-Agent: Blood Bank Liaison
  // ---------------------------------------------------------------------------
  const bloodBankLiaisonAgent = new Agent({
    name: 'blood-bank-liaison-agent',
    instructions: getBloodBankLiaisonAgentInstructions,
    model: 'openai/gpt-4o-mini',
    tools: bloodBankLiaisonAgentTools,
    memory: sharedMemory,
    maxSteps: 20,
  });

  // ---------------------------------------------------------------------------
  // Sub-Agent: Eligibility & Timing
  // ---------------------------------------------------------------------------
  const eligibilityTimingAgent = new Agent({
    name: 'eligibility-timing-agent',
    instructions: getEligibilityTimingAgentInstructions,
    model: 'openai/gpt-4o-mini',
    tools: eligibilityTimingAgentTools,
    memory: sharedMemory,
    maxSteps: 20,
  });

  // ---------------------------------------------------------------------------
  // Sub-Agent: Result Reporting
  // ---------------------------------------------------------------------------
  const resultReportingAgent = new Agent({
    name: 'result-reporting-agent',
    instructions: getResultReportingAgentInstructions,
    model: 'openai/gpt-4o-mini',
    tools: resultReportingAgentTools,
    memory: sharedMemory,
    maxSteps: 20,
  });

  // ---------------------------------------------------------------------------
  // Coordinator Agent (Master Orchestrator)
  // ---------------------------------------------------------------------------
  return new Agent({
    name: 'sangroot-coordinator',
    instructions: getCoordinatorAgentInstructions,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 30,
    subAgents: [
      donorOutreachAgent,
      bloodBankLiaisonAgent,
      eligibilityTimingAgent,
      resultReportingAgent,
    ],
  });
}
