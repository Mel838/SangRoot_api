import { Agent, Memory } from '@voltagent/core';
import { getConversationPrompt } from '../prompts';
import {
  loadDonorConversation,
  sendDonorMessage,
  recordDonorResponse,
  flagDonorOptOut,
  checkDonorEligibility,
  updateDonorProfile,
} from '../tools/donor.tools';
import {
  loadBloodBankConversation,
  sendBloodBankMessage,
  recordBloodBankResponse,
  updateBloodBankProfile,
} from '../tools/blood-bank.tools';
import {
  classifyMessageIntent,
  getActiveRequestForEntity,
  notifyDoctorCoordinator,
} from '../tools/routing.tools';

export function createConversationAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'conversation-agent',
    instructions: getConversationPrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 10,
    tools: [
      classifyMessageIntent,
      loadDonorConversation,
      loadBloodBankConversation,
      getActiveRequestForEntity,
      sendDonorMessage,
      sendBloodBankMessage,
      recordDonorResponse,
      recordBloodBankResponse,
      flagDonorOptOut,
      checkDonorEligibility,
      updateDonorProfile,
      updateBloodBankProfile,
      notifyDoctorCoordinator,
    ],
  });
}
