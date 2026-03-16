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

export interface TaskQueueStats {
  total_tasks: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
}

export interface TaskCreateRequest {
  title: string;
  description?: string;
  task_type?: string;
  priority?: number;
}

export const tasksApi = {
  /** Get recent agent tasks (alias for agentsApi.getRecentTasks) */
  getRecent: (limit = 20): Promise<import('./agents').AgentTask[]> =>
    apiClient.get(`/api/agents/tasks/recent?limit=${limit}`),

  /** Get task queue statistics summary */
  getStatsSummary: (): Promise<TaskQueueStats> => apiClient.get('/api/tasks/stats/summary'),

  /** List tasks with optional filters */
  list: (params?: { status?: string; page_size?: number }): Promise<TaskListResponse> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    query.set('page_size', String(params?.page_size ?? 50));
    return apiClient.get(`/api/tasks?${query.toString()}`);
  },

  /** Submit a new task */
  create: (data: TaskCreateRequest): Promise<import('./agents').AgentTask> =>
    apiClient.post('/api/tasks', data),
};
