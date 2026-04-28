import { Agent, Memory } from '@voltagent/core';
import { getEscalationPrompt } from '../prompts';
import { fetchRegionalAlternatives, sendDoctorNotification } from '../tools';

export function createEscalationAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'escalation-agent',
    instructions: getEscalationPrompt,
    model: 'openai/gpt-4o',
    memory: sharedMemory,
    maxSteps: 5,
    tools: [fetchRegionalAlternatives, sendDoctorNotification],
  });
}
