import { VoltAgent } from '@voltagent/core';
import { honoServer } from '@voltagent/server-hono';
import { createPinoLogger } from '@voltagent/logger';
import 'dotenv/config';
import { agent as coordinator } from './agents';

const logger = createPinoLogger({
  name: 'sangroot-agent',
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
});

/**
 * SangRoot VoltAgent Server
 *
 * Exposes the Coordinator Agent (and its sub-agents) via the Hono HTTP server.
 * The NestJS backend triggers blood coordination workflows by calling this server
 * with the blood request payload.
 *
 * Default port: 3141
 * Override with VOLT_PORT environment variable.
 */
new VoltAgent({
  agents: { coordinator },
  server: honoServer({
    port: process.env.VOLT_PORT ? parseInt(process.env.VOLT_PORT, 10) : 3141,
  }),
  logger,
});
