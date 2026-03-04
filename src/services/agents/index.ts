import { VoltAgent } from '@voltagent/core';
import { honoServer } from '@voltagent/server-hono';
import { createPinoLogger } from '@voltagent/logger';
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { createCoordinatorAgent } from './agents';

/**
 * Standalone VoltAgent entry point.
 *
 * This file is NOT used when running inside NestJS — VoltAgentModule handles
 * everything there. This exists only if you need to run the agent server
 * independently outside of the NestJS application.
 */
const config = new ConfigService();

const logger = createPinoLogger({
  name: 'sangroot-agent',
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
});

const coordinator = createCoordinatorAgent(config);

new VoltAgent({
  agents: { coordinator },
  server: honoServer({
    port: process.env.VOLT_PORT ? parseInt(process.env.VOLT_PORT, 10) : 3141,
  }),
  logger,
});
