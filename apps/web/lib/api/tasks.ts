/**
 * Tasks API client.
 *
 * Typed client for agent task management endpoints.
 * Re-exports task types from agents.ts for convenience.
 */

export type { AgentTask } from './agents';
import { apiClient } from './client';

export interface TaskListResponse {
  tasks: import('./agents').AgentTask[];
  total: number;
}

export const tasksApi = {
  /** Get recent agent tasks (alias for agentsApi.getRecentTasks) */
  getRecent: (limit = 20): Promise<import('./agents').AgentTask[]> =>
    apiClient.get(`/api/agents/tasks/recent?limit=${limit}`),
};
