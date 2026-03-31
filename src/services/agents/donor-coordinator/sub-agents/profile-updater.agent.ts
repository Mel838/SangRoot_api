import { Agent, Memory } from '@voltagent/core';
import { getProfileUpdaterPrompt } from '../prompts';
import {
  loadDonorConversation,
  updateDonorProfile,
} from '../tools/donor.tools';
import {
  loadBloodBankConversation,
  updateBloodBankProfile,
} from '../tools/blood-bank.tools';

export function createProfileUpdaterAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'profile-updater-agent',
    instructions: getProfileUpdaterPrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 5,
    tools: [
      loadDonorConversation,
      updateDonorProfile,
      loadBloodBankConversation,
      updateBloodBankProfile,
    ],
  });
}
