import { Agent, Memory } from '@voltagent/core';
import { getTriagePrompt } from '../prompts';
import { fetchEligibilitySummary } from '../tools';

export function createTriageAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'triage-agent',
    instructions: getTriagePrompt,
    model: 'openai/gpt-4o',
    memory: sharedMemory,
    maxSteps: 3,
    tools: [fetchEligibilitySummary],
  });
}
