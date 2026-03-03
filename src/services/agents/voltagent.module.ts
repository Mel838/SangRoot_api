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
import { agent as coordinator } from './agents';

const VOLT_AGENT_TOKEN = 'VOLT_AGENT';

@Module({
  providers: [
    {
      provide: VOLT_AGENT_TOKEN,
      useFactory: (config: ConfigService) => {
        const logger = createPinoLogger({
          name: 'sangroot-agent',
          level: config.get('NODE_ENV') === 'production' ? 'warn' : 'info',
        });

        const port = config.get<number>('VOLT_PORT') ?? 3141;

        return new VoltAgent({
          agents: { coordinator },
          server: honoServer({ port }),
          logger,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [VOLT_AGENT_TOKEN],
})
export class VoltAgentModule
  implements OnApplicationBootstrap, OnModuleDestroy
{
  constructor(
    @Inject(VOLT_AGENT_TOKEN) private readonly voltAgent: VoltAgent,
  ) {}

  onApplicationBootstrap() {
    // VoltAgent starts automatically when instantiated via honoServer().
    // Nothing extra needed here — the server is already listening.
  }

  async onModuleDestroy() {
    // Gracefully shut down the VoltAgent HTTP server when NestJS stops.
    try {
      await (
        this.voltAgent as unknown as { stop?: () => Promise<void> }
      ).stop?.();
    } catch {
      // Ignore shutdown errors — process is exiting anyway.
    }
  }
}
