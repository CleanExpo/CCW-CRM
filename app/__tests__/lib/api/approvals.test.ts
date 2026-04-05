import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { approvalsApi } from '@/lib/api/approvals';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const mockApproval = {
  id: 'appr-1',
  approval_type: 'purchase_order',
  entity_id: 'po-1',
  entity_type: 'purchase_order',
  status: 'pending',
  total_steps: 2,
  current_step: 1,
  requested_by: 'user-1',
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  completed_at: null,
  steps: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('approvalsApi.list', () => {
  it('calls GET /api/approvals with no params', async () => {
    mockGet.mockResolvedValue({ data: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    await approvalsApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/approvals');
  });

  it('appends filters to query string', async () => {
    mockGet.mockResolvedValue({ data: [], total: 0 });
    await approvalsApi.list({ page: 2, status_filter: 'pending', approval_type: 'purchase_order' });
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('status_filter=pending');
    expect(url).toContain('approval_type=purchase_order');
  });
});

describe('approvalsApi.get', () => {
  it('calls GET /api/approvals/:id', async () => {
    mockGet.mockResolvedValue(mockApproval);
    await approvalsApi.get('appr-1');
    expect(mockGet).toHaveBeenCalledWith('/api/approvals/appr-1');
  });
});

describe('approvalsApi.create', () => {
  it('calls POST /api/approvals', async () => {
    mockPost.mockResolvedValue(mockApproval);
    const data = {
      approval_type: 'purchase_order',
      entity_id: 'po-1',
      entity_type: 'purchase_order',
      total_steps: 2,
      requested_by: 'user-1',
    };
    await approvalsApi.create(data);
    expect(mockPost).toHaveBeenCalledWith('/api/approvals', data);
  });
});

describe('approvalsApi.addStep', () => {
  it('calls POST /api/approvals/:id/steps', async () => {
    mockPost.mockResolvedValue({ id: 'step-1', step_number: 1 });
    const data = { step_number: 1, approver_id: 'user-2' };
    await approvalsApi.addStep('appr-1', data);
    expect(mockPost).toHaveBeenCalledWith('/api/approvals/appr-1/steps', data);
  });
});

describe('approvalsApi.reviewStep', () => {
  it('calls PUT /api/approvals/:id/steps/:stepId', async () => {
    mockPut.mockResolvedValue({ id: 'step-1', status: 'approved' });
    await approvalsApi.reviewStep('appr-1', 'step-1', { action: 'approve', comments: 'LGTM' });
    expect(mockPut).toHaveBeenCalledWith('/api/approvals/appr-1/steps/step-1', {
      action: 'approve',
      comments: 'LGTM',
    });
  });
});

describe('approvalsApi.cancel', () => {
  it('calls DELETE /api/approvals/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await approvalsApi.cancel('appr-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/approvals/appr-1');
  });
});
