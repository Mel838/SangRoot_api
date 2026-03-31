import {
  Module,
  OnModuleDestroy,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VoltAgent } from '@voltagent/core';
import { honoServer } from '@voltagent/server-hono';
import { createPinoLogger } from '@voltagent/logger';
import { createDoctorCoordinatorAgent } from './doctor-coordinator/agent';
import { createDonorCoordinatorAgent } from './donor-coordinator/agent';
import type { Agent } from '@voltagent/core';

export const DOCTOR_COORDINATOR_TOKEN = 'DOCTOR_COORDINATOR_AGENT';
export const DONOR_COORDINATOR_TOKEN = 'DONOR_COORDINATOR_AGENT';
export const VOLT_AGENT_TOKEN = 'VOLT_AGENT';

// Keep the old token as an alias so existing code (blood-requests.service.ts,
// whatsapp.service.ts etc.) can still use COORDINATOR_AGENT_TOKEN without
// modification.
export const COORDINATOR_AGENT_TOKEN = DOCTOR_COORDINATOR_TOKEN;

@Module({
  providers: [
    {
      provide: DOCTOR_COORDINATOR_TOKEN,
      useFactory: (config: ConfigService) =>
        createDoctorCoordinatorAgent(config),
      inject: [ConfigService],
    },
    {
      provide: DONOR_COORDINATOR_TOKEN,
      useFactory: (config: ConfigService) =>
        createDonorCoordinatorAgent(config),
      inject: [ConfigService],
    },
    {
      provide: VOLT_AGENT_TOKEN,
      useFactory: (
        doctorCoordinator: Agent,
        donorCoordinator: Agent,
        config: ConfigService,
      ) => {
        const logger = createPinoLogger({
          name: 'sangroot-agent',
          level: config.get('NODE_ENV') === 'production' ? 'warn' : 'info',
        });

        const port = config.get<number>('VOLT_PORT') ?? 3141;

        return new VoltAgent({
          agents: { doctorCoordinator, donorCoordinator },
          server: honoServer({ port }),
          logger,
        });
      },
      inject: [
        DOCTOR_COORDINATOR_TOKEN,
        DONOR_COORDINATOR_TOKEN,
        ConfigService,
      ],
    },
  ],
  exports: [
    VOLT_AGENT_TOKEN,
    DOCTOR_COORDINATOR_TOKEN,
    DONOR_COORDINATOR_TOKEN,
  ],
})
export class VoltAgentModule
  implements OnApplicationBootstrap, OnModuleDestroy
{
  constructor(
    @Inject(VOLT_AGENT_TOKEN) private readonly voltAgent: VoltAgent,
  ) {}

  onApplicationBootstrap() {
    // VoltAgent starts automatically when instantiated via honoServer().
  }

  async onModuleDestroy() {
    try {
      await (
        this.voltAgent as unknown as { stop?: () => Promise<void> }
      ).stop?.();
    } catch {
      // Ignore shutdown errors — process is exiting anyway.
    }
  }
}
