import { Agent, Memory } from '@voltagent/core';
import { getDonorOutreachPrompt } from '../prompts';
import {
  fetchMatchingDonors,
  fetchDonorProfile,
  loadDonorConversation,
  sendDonorMessage,
  recordDonorResponse,
  checkDonorEligibility,
} from '../tools/donor.tools';

export function createDonorOutreachAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'donor-outreach-agent',
    instructions: getDonorOutreachPrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 10,
    tools: [
      fetchMatchingDonors,
      fetchDonorProfile,
      loadDonorConversation,
      sendDonorMessage,
      recordDonorResponse,
      checkDonorEligibility,
    ],
  });
}
