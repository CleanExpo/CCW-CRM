import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { agentsApi } from '@/lib/api/agents';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => vi.clearAllMocks());

const mockStats = {
  total_agents: 5,
  active_agents: 3,
  total_tasks: 120,
  successful_tasks: 110,
  failed_tasks: 10,
  success_rate: 0.917,
  avg_iterations: 1.2,
  avg_duration_seconds: 2.5,
};

const mockAgentList = [
  {
    agent_id: 'agent-1',
    agent_type: 'Forecasting',
    status: 'active',
    task_count: 50,
    success_rate: 0.96,
  },
];

const mockTasks = [
  {
    task_id: 'task-1',
    status: 'completed',
    description: 'Analyse inventory trends',
    agent_type: 'forecasting',
    verified: true,
    iterations: 1,
    duration_seconds: 1.2,
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('agentsApi.getStats', () => {
  it('calls GET /api/agents/stats', async () => {
    mockGet.mockResolvedValue(mockStats);
    await agentsApi.getStats();
    expect(mockGet).toHaveBeenCalledWith('/api/agents/stats');
  });

  it('returns agent stats', async () => {
    mockGet.mockResolvedValue(mockStats);
    const result = await agentsApi.getStats();
    expect(result.total_agents).toBe(5);
    expect(result.success_rate).toBeCloseTo(0.917);
  });
});

describe('agentsApi.listAgents', () => {
  it('calls GET /api/agents/list', async () => {
    mockGet.mockResolvedValue(mockAgentList);
    await agentsApi.listAgents();
    expect(mockGet).toHaveBeenCalledWith('/api/agents/list');
  });

  it('returns agent list', async () => {
    mockGet.mockResolvedValue(mockAgentList);
    const result = await agentsApi.listAgents();
    expect(result[0].agent_id).toBe('agent-1');
  });
});

describe('agentsApi.getRecentTasks', () => {
  it('calls GET /api/agents/tasks/recent with default limit', async () => {
    mockGet.mockResolvedValue(mockTasks);
    await agentsApi.getRecentTasks();
    expect(mockGet).toHaveBeenCalledWith('/api/agents/tasks/recent?limit=10');
  });

  it('uses custom limit', async () => {
    mockGet.mockResolvedValue(mockTasks);
    await agentsApi.getRecentTasks(25);
    expect(mockGet).toHaveBeenCalledWith('/api/agents/tasks/recent?limit=25');
  });

  it('returns task list', async () => {
    mockGet.mockResolvedValue(mockTasks);
    const result = await agentsApi.getRecentTasks();
    expect(result[0].task_id).toBe('task-1');
    expect(result[0].verified).toBe(true);
  });
});

describe('agentsApi.getPerformanceTrends', () => {
  it('calls GET /api/agents/performance/trends with default days', async () => {
    mockGet.mockResolvedValue({ data_points: [] });
    await agentsApi.getPerformanceTrends();
    expect(mockGet).toHaveBeenCalledWith('/api/agents/performance/trends?days=7');
  });

  it('uses custom days', async () => {
    mockGet.mockResolvedValue({ data_points: [] });
    await agentsApi.getPerformanceTrends(14);
    expect(mockGet).toHaveBeenCalledWith('/api/agents/performance/trends?days=14');
  });
});

describe('agentsApi.getInsights', () => {
  it('calls GET /api/agents/insights', async () => {
    mockGet.mockResolvedValue({ insights: [] });
    await agentsApi.getInsights();
    expect(mockGet).toHaveBeenCalledWith('/api/agents/insights');
  });
});
