import { Agent, Memory } from '@voltagent/core';
import { getFollowUpPrompt } from '../prompts';
import {
  loadDonorConversation,
  sendDonorMessage,
  recordDonorResponse,
} from '../tools/donor.tools';

export function createFollowUpAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'follow-up-agent',
    instructions: getFollowUpPrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 5,
    tools: [loadDonorConversation, sendDonorMessage, recordDonorResponse],
  });
}
