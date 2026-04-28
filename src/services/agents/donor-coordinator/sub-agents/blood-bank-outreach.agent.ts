import { Agent, Memory } from '@voltagent/core';
import { getBloodBankOutreachPrompt } from '../prompts';
import {
  fetchNearbyBloodBanks,
  fetchBloodBankProfile,
  loadBloodBankConversation,
  sendBloodBankMessage,
  recordBloodBankResponse,
} from '../tools/blood-bank.tools';

export function createBloodBankOutreachAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'blood-bank-outreach-agent',
    instructions: getBloodBankOutreachPrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 8,
    tools: [
      fetchNearbyBloodBanks,
      fetchBloodBankProfile,
      loadBloodBankConversation,
      sendBloodBankMessage,
      recordBloodBankResponse,
    ],
  });
}
