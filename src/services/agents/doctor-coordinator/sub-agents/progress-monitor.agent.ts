import { Agent, Memory } from '@voltagent/core';
import { getProgressMonitorPrompt } from '../prompts';
import { fetchOutreachProgress, sendDoctorNotification } from '../tools';

export function createProgressMonitorAgent(sharedMemory: Memory): Agent {
  return new Agent({
    name: 'progress-monitor-agent',
    instructions: getProgressMonitorPrompt,
    model: 'openai/gpt-4o-mini',
    memory: sharedMemory,
    maxSteps: 5,
    tools: [fetchOutreachProgress, sendDoctorNotification],
  });
}
