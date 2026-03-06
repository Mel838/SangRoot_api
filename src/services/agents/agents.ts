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

export function createCoordinatorAgent(config: ConfigService): Agent {
  const databaseUrl = config.get<string>('DATABASE_URL');
  if (!databaseUrl)
    throw new Error('[VoltAgent] Missing DATABASE_URL env variable');

  const sharedMemory = new Memory({
    storage: new PostgreSQLMemoryAdapter({
      connection: databaseUrl,
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
    maxSteps: 7,
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
    maxSteps: 7,
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
    maxSteps: 7,
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
    maxSteps: 7,
  });

  // ---------------------------------------------------------------------------
  // Coordinator Agent (Master Orchestrator)
  // ---------------------------------------------------------------------------
  return new Agent({
    name: 'sangroot-coordinator',
    instructions: getCoordinatorAgentInstructions,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 10,
    subAgents: [
      donorOutreachAgent,
      bloodBankLiaisonAgent,
      eligibilityTimingAgent,
      resultReportingAgent,
    ],
  });
}
