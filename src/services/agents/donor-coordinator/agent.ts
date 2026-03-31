import { Agent, Memory } from '@voltagent/core';
import { PostgreSQLMemoryAdapter } from '@voltagent/postgres';
import { ConfigService } from '@nestjs/config';
import { getDonorCoordinatorPrompt } from './prompts';
import { donorTools } from './tools/donor.tools';
import { bloodBankTools } from './tools/blood-bank.tools';
import { routingTools } from './tools/routing.tools';
import { createOnboardingAgent } from './sub-agents/onboarding.agent';
import { createDonorOutreachAgent } from './sub-agents/donor-outreach.agent';
import { createBloodBankOutreachAgent } from './sub-agents/blood-bank-outreach.agent';
import { createConversationAgent } from './sub-agents/conversation.agent';
import { createFollowUpAgent } from './sub-agents/follow-up.agent';
import { createEligibilityCheckerAgent } from './sub-agents/eligibility-checker.agent';
import { createProfileUpdaterAgent } from './sub-agents/profile-updater.agent';

export function createDonorCoordinatorAgent(config: ConfigService): Agent {
  const databaseUrl = config.get<string>('DATABASE_URL');
  if (!databaseUrl)
    throw new Error('[DonorCoordinator] Missing DATABASE_URL env variable');

  const sharedMemory = new Memory({
    storage: new PostgreSQLMemoryAdapter({
      connection: databaseUrl,
      tablePrefix: 'sangroot_agent_memory',
    }),
  });

  return new Agent({
    name: 'donor-coordinator',
    instructions: getDonorCoordinatorPrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 20,
    tools: [...donorTools, ...bloodBankTools, ...routingTools],
    subAgents: [
      createOnboardingAgent(sharedMemory),
      createDonorOutreachAgent(sharedMemory),
      createBloodBankOutreachAgent(sharedMemory),
      createConversationAgent(sharedMemory),
      createFollowUpAgent(sharedMemory),
      createEligibilityCheckerAgent(sharedMemory),
      createProfileUpdaterAgent(sharedMemory),
    ],
  });
}
