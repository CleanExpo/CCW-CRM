/**
 * Workflows API Client Extended Tests
 *
 * Tests for SLA escalation and execution stats endpoints (Phase 2 - Batch 2C)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api/client';

// Extended workflows API methods (Phase 2 additions)
const workflowsApiExtended = {
  async escalateSLA(taskId: string, escalationLevel: number) {
    return apiClient.post('/api/workflows/sla/escalate', {
      task_id: taskId,
      escalation_level: escalationLevel,
    });
  },

  async getExecutionStats(templateId?: string) {
    const query = templateId ? `?template_id=${templateId}` : '';
    return apiClient.get(`/api/workflows/execution-stats${query}`);
  },
};

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

// ─── SLA Escalation ─────────────────────────────────────────────────

describe('workflowsApiExtended.escalateSLA', () => {
  it('calls POST /api/workflows/sla/escalate with task and level', async () => {
    const mockEscalated = {
      task_id: 'task-123',
      escalation_level: 2,
      new_assignee: 'manager-1',
      escalated_at: '2026-03-17T12:00:00Z',
    };
    mockPost.mockResolvedValue(mockEscalated);

    const result = await workflowsApiExtended.escalateSLA('task-123', 2);

    expect(mockPost).toHaveBeenCalledWith('/api/workflows/sla/escalate', {
      task_id: 'task-123',
      escalation_level: 2,
    });
    expect(result.new_assignee).toBe('manager-1');
  });

  it('handles escalation to level 1 (first escalation)', async () => {
    mockPost.mockResolvedValue({ escalation_level: 1 });
    await workflowsApiExtended.escalateSLA('task-456', 1);
    expect(mockPost).toHaveBeenCalledWith('/api/workflows/sla/escalate', {
      task_id: 'task-456',
      escalation_level: 1,
    });
  });
});

// ─── Execution Stats ────────────────────────────────────────────────

describe('workflowsApiExtended.getExecutionStats', () => {
  it('calls GET /api/workflows/execution-stats with no filter', async () => {
    const mockStats = {
      total_executions: 150,
      successful: 130,
      failed: 15,
      in_progress: 5,
      avg_duration_seconds: 45.2,
    };
    mockGet.mockResolvedValue(mockStats);

    const result = await workflowsApiExtended.getExecutionStats();

    expect(mockGet).toHaveBeenCalledWith('/api/workflows/execution-stats');
    expect(result.total_executions).toBe(150);
  });

  it('calls GET /api/workflows/execution-stats with template_id filter', async () => {
    mockGet.mockResolvedValue({ total_executions: 25, successful: 23 });

    await workflowsApiExtended.getExecutionStats('template-123');

    expect(mockGet).toHaveBeenCalledWith('/api/workflows/execution-stats?template_id=template-123');
  });

  it('returns stats with zero executions for new templates', async () => {
    mockGet.mockResolvedValue({
      total_executions: 0,
      successful: 0,
      failed: 0,
      in_progress: 0,
    });

    const result = await workflowsApiExtended.getExecutionStats('new-template');
    expect(result.total_executions).toBe(0);
  });
});
