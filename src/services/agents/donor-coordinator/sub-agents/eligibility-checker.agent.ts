import { Agent, Memory } from '@voltagent/core';
import { getEligibilityCheckerPrompt } from '../prompts';
import {
  checkDonorEligibility,
  sendDonorMessage,
  updateDonorProfile,
  recordDonorResponse,
} from '../tools/donor.tools';

export function createEligibilityCheckerAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'eligibility-checker-agent',
    instructions: getEligibilityCheckerPrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 5,
    tools: [
      checkDonorEligibility,
      sendDonorMessage,
      updateDonorProfile,
      recordDonorResponse,
    ],
  });
}
