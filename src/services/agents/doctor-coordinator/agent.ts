import { Agent, Memory } from '@voltagent/core';
import { PostgreSQLMemoryAdapter } from '@voltagent/postgres';
import { ConfigService } from '@nestjs/config';
import { getDoctorCoordinatorPrompt } from './prompts';
import { doctorCoordinatorTools } from './tools';
import { createTriageAgent } from './sub-agents/triage.agent';
import { createBridgeAgent } from './sub-agents/bridge.agent';
import { createProgressMonitorAgent } from './sub-agents/progress-monitor.agent';
import { createEligibilityReportAgent } from './sub-agents/eligibility-report.agent';
import { createEscalationAgent } from './sub-agents/escalation.agent';

export function createDoctorCoordinatorAgent(config: ConfigService): Agent {
  const rawUrl = config.get<string>('DATABASE_URL') ?? '';
  const databaseUrl = rawUrl.split('?')[0]; // strip ?schema=... Prisma param
  if (!databaseUrl)
    throw new Error('[DoctorCoordinator] Missing DATABASE_URL env variable');

  const sharedMemory = new Memory({
    storage: new PostgreSQLMemoryAdapter({
      connection: {
        connectionString: databaseUrl,
        ssl: {
          rejectUnauthorized: false,
        },
      } as any,
      tablePrefix: 'sangroot_agent_memory',
    }),
  });

  const triageAgent = createTriageAgent(sharedMemory);
  const bridgeAgent = createBridgeAgent(sharedMemory);
  const progressMonitorAgent = createProgressMonitorAgent(sharedMemory);
  const eligibilityReportAgent = createEligibilityReportAgent(sharedMemory);
  const escalationAgent = createEscalationAgent(sharedMemory);

  return new Agent({
    name: 'doctor-coordinator',
    instructions: getDoctorCoordinatorPrompt,
    model: 'openai/gpt-4o',
    memory: sharedMemory,
    maxSteps: 15,
    tools: doctorCoordinatorTools,
    subAgents: [
      triageAgent,
      bridgeAgent,
      progressMonitorAgent,
      eligibilityReportAgent,
      escalationAgent,
    ],
  });
}
