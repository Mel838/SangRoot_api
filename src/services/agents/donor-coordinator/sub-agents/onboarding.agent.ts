import { Agent, Memory } from '@voltagent/core';
import { getOnboardingPrompt } from '../prompts';
import { sendDonorMessage, updateDonorProfile } from '../tools/donor.tools';

export function createOnboardingAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'onboarding-agent',
    instructions: getOnboardingPrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 10,
    tools: [sendDonorMessage, updateDonorProfile],
  });
}
