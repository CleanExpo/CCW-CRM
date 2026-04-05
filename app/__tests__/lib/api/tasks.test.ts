import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { tasksApi } from '@/lib/api/tasks';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

const mockTask = {
  task_id: 'task-1',
  status: 'completed',
  description: 'Test task',
  agent_type: 'general',
  verified: false,
  iterations: 1,
  duration_seconds: 2.0,
  created_at: '2026-01-01T00:00:00Z',
};

const mockStats = {
  total_tasks: 42,
  pending: 5,
  in_progress: 2,
  completed: 30,
  failed: 5,
};

describe('tasksApi.getRecent', () => {
  it('calls GET with default limit of 20', async () => {
    mockGet.mockResolvedValue([mockTask]);
    await tasksApi.getRecent();
    expect(mockGet).toHaveBeenCalledWith('/api/agents/tasks/recent?limit=20');
  });

  it('uses custom limit', async () => {
    mockGet.mockResolvedValue([mockTask]);
    await tasksApi.getRecent(50);
    expect(mockGet).toHaveBeenCalledWith('/api/agents/tasks/recent?limit=50');
  });

  it('returns task array', async () => {
    mockGet.mockResolvedValue([mockTask]);
    const result = await tasksApi.getRecent();
    expect(result[0].task_id).toBe('task-1');
  });
});

describe('tasksApi.getStatsSummary', () => {
  it('calls GET /api/tasks/stats/summary', async () => {
    mockGet.mockResolvedValue(mockStats);
    await tasksApi.getStatsSummary();
    expect(mockGet).toHaveBeenCalledWith('/api/tasks/stats/summary');
  });

  it('returns queue stats', async () => {
    mockGet.mockResolvedValue(mockStats);
    const result = await tasksApi.getStatsSummary();
    expect(result.total_tasks).toBe(42);
    expect(result.pending).toBe(5);
    expect(result.completed).toBe(30);
  });
});

describe('tasksApi.list', () => {
  const mockListResponse = { tasks: [mockTask], total: 1 };

  it('calls GET /api/tasks with default page_size', async () => {
    mockGet.mockResolvedValue(mockListResponse);
    await tasksApi.list();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/tasks?'));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page_size=50'));
  });

  it('appends status filter when provided', async () => {
    mockGet.mockResolvedValue(mockListResponse);
    await tasksApi.list({ status: 'pending' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('status=pending'));
  });

  it('uses custom page_size', async () => {
    mockGet.mockResolvedValue(mockListResponse);
    await tasksApi.list({ page_size: 10 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page_size=10'));
  });

  it('returns task list response', async () => {
    mockGet.mockResolvedValue(mockListResponse);
    const result = await tasksApi.list();
    expect(result.tasks).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

describe('tasksApi.create', () => {
  it('calls POST /api/tasks with task data', async () => {
    mockPost.mockResolvedValue(mockTask);
    const payload = {
      title: 'Fix inventory sync',
      description: 'Urgent',
      task_type: 'bug',
      priority: 1,
    };
    await tasksApi.create(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/tasks', payload);
  });

  it('returns created task', async () => {
    mockPost.mockResolvedValue(mockTask);
    const result = await tasksApi.create({ title: 'New task' });
    expect(result.task_id).toBe('task-1');
  });

  it('accepts minimal payload (title only)', async () => {
    mockPost.mockResolvedValue(mockTask);
    await tasksApi.create({ title: 'Minimal' });
    expect(mockPost).toHaveBeenCalledWith('/api/tasks', { title: 'Minimal' });
  });
});
