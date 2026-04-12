/**
 * Agent monitoring API client.
 *
 * Typed client for /api/agents/* endpoints created by UNI-1246.
 */

import { apiClient } from './client';

export interface AgentStats {
  total_agents: number;
  active_agents: number;
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  success_rate: number;
  avg_iterations: number;
  avg_duration_seconds: number;
}

export interface Agent {
  agent_id: string;
  agent_type: string;
  status: string;
  task_count: number;
  success_rate: number;
}

export interface AgentTask {
  task_id: string;
  status: string;
  description: string | null;
  agent_type: string;
  verified: boolean;
  iterations: number;
  duration_seconds: number | null;
  created_at: string;
}

export interface PerformanceDataPoint {
  date: string;
  tasks_completed: number;
  success_rate: number;
}

export interface PerformanceTrends {
  data_points: PerformanceDataPoint[];
}

export interface AgentInsight {
  insight_id: string;
  insight_type: string;
  agent_id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommended_action: string;
  expected_improvement: number;
  supporting_patterns: string[];
  created_at: string;
}

export interface AgentInsights {
  insights: AgentInsight[];
}

export const agentsApi = {
  getStats: (): Promise<AgentStats> => apiClient.get<AgentStats>('/api/agents/stats'),

  listAgents: (): Promise<Agent[]> => apiClient.get<Agent[]>('/api/agents/list'),

  getRecentTasks: (limit = 10): Promise<AgentTask[]> =>
    apiClient.get<AgentTask[]>(`/api/agents/tasks/recent?limit=${limit}`),

  getPerformanceTrends: (days = 7): Promise<PerformanceTrends> =>
    apiClient.get<PerformanceTrends>(`/api/agents/performance/trends?days=${days}`),

  getInsights: (): Promise<AgentInsights> => apiClient.get<AgentInsights>('/api/agents/insights'),
};
