import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { autonomousApi } from '@/lib/api/autonomous';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('autonomousApi.startExecution', () => {
  it('posts to /api/ai/autonomous/start with request body', async () => {
    mockPost.mockResolvedValue({ task_id: 'task-1', status: 'started', message: 'ok' });
    const result = await autonomousApi.startExecution({
      task_description: 'Build something',
      approval_mode: 'manual',
    });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/autonomous/start', {
      task_description: 'Build something',
      approval_mode: 'manual',
    });
    expect(result.task_id).toBe('task-1');
  });
});

describe('autonomousApi.getTaskStatus', () => {
  it('gets status for a task id', async () => {
    mockGet.mockResolvedValue({ task_id: 'task-1', exists: true, state: null });
    await autonomousApi.getTaskStatus('task-1');
    expect(mockGet).toHaveBeenCalledWith('/api/ai/autonomous/status/task-1');
  });
});

describe('autonomousApi.pauseTask', () => {
  it('posts to pause endpoint', async () => {
    mockPost.mockResolvedValue({ message: 'paused' });
    await autonomousApi.pauseTask('task-1');
    expect(mockPost).toHaveBeenCalledWith('/api/ai/autonomous/task-1/pause', {});
  });
});

describe('autonomousApi.resumeTask', () => {
  it('posts to resume endpoint', async () => {
    mockPost.mockResolvedValue({ message: 'resumed' });
    await autonomousApi.resumeTask('task-1');
    expect(mockPost).toHaveBeenCalledWith('/api/ai/autonomous/task-1/resume', {});
  });
});

describe('autonomousApi.cancelTask', () => {
  it('posts to cancel endpoint', async () => {
    mockPost.mockResolvedValue({ message: 'cancelled' });
    await autonomousApi.cancelTask('task-1');
    expect(mockPost).toHaveBeenCalledWith('/api/ai/autonomous/task-1/cancel', {});
  });
});

describe('autonomousApi.approveGate', () => {
  it('posts to approve gate endpoint', async () => {
    mockPost.mockResolvedValue({
      task_id: 'task-1',
      gate_id: 2,
      status: 'approved',
      message: 'ok',
      next_action: 'continue',
    });
    await autonomousApi.approveGate('task-1', { gate_id: 2, approved_by: 'admin' });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/autonomous/gates/task-1/approve', {
      gate_id: 2,
      approved_by: 'admin',
    });
  });
});

describe('autonomousApi.rejectGate', () => {
  it('posts to reject gate endpoint', async () => {
    mockPost.mockResolvedValue({
      task_id: 'task-1',
      gate_id: 2,
      status: 'rejected',
      message: 'rejected',
      next_action: 'stop',
    });
    await autonomousApi.rejectGate('task-1', { gate_id: 2, feedback: 'Not ready' });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/autonomous/gates/task-1/reject', {
      gate_id: 2,
      feedback: 'Not ready',
    });
  });
});

describe('autonomousApi.listGates', () => {
  it('gets gates for a task', async () => {
    mockGet.mockResolvedValue({ task_id: 'task-1', gates: [], current_gate: null });
    await autonomousApi.listGates('task-1');
    expect(mockGet).toHaveBeenCalledWith('/api/ai/autonomous/gates/task-1');
  });
});
