import { Agent, Memory } from '@voltagent/core';
import { getEligibilityReportPrompt } from '../prompts';
import { fetchEligibilitySummary } from '../tools';

export function createEligibilityReportAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'eligibility-report-agent',
    instructions: getEligibilityReportPrompt,
    model: 'openai/gpt-4o',
    memory: sharedMemory,
    maxSteps: 5,
    tools: [fetchEligibilitySummary],
  });
}
