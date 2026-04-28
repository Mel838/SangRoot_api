import { Agent, Memory } from '@voltagent/core';
import { getBridgePrompt } from '../prompts';
import { triggerDonorCoordinator } from '../tools';

export function createBridgeAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'bridge-agent',
    instructions: getBridgePrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 3,
    tools: [triggerDonorCoordinator],
  });
}
