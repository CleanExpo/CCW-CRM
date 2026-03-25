/**
 * Approvals API Client Extended Tests
 *
 * Tests for pending approvals and bulk approve endpoints (Phase 2 - Batch 2C)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api/client';

// Extended approvals API methods (Phase 2 additions)
const approvalsApiExtended = {
  async getPendingMyApproval() {
    return apiClient.get('/api/approvals/pending-my-approval');
  },

  async bulkApprove(approvalIds: string[], comments?: string) {
    return apiClient.post('/api/approvals/bulk-approve', {
      approval_ids: approvalIds,
      comments,
    });
  },
};

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

// ─── Pending My Approval ────────────────────────────────────────────

describe('approvalsApiExtended.getPendingMyApproval', () => {
  it('calls GET /api/approvals/pending-my-approval (requires JWT)', async () => {
    const mockPending = [
      { id: 'appr-1', approval_type: 'purchase_order', entity_id: 'po-1', current_step: 1 },
      { id: 'appr-2', approval_type: 'invoice', entity_id: 'inv-5', current_step: 2 },
    ];
    mockGet.mockResolvedValue(mockPending);

    const result = await approvalsApiExtended.getPendingMyApproval();

    expect(mockGet).toHaveBeenCalledWith('/api/approvals/pending-my-approval');
    expect(result as any[]).toHaveLength(2);
    expect((result as any[])[0].approval_type).toBe('purchase_order');
  });

  it('returns empty array when user has no pending approvals', async () => {
    mockGet.mockResolvedValue([]);
    const result = await approvalsApiExtended.getPendingMyApproval();
    expect(result as any[]).toEqual([]);
  });

  it('throws error when not authenticated', async () => {
    mockGet.mockRejectedValue(new Error('Unauthorized - JWT required'));
    await expect(approvalsApiExtended.getPendingMyApproval()).rejects.toThrow('Unauthorized');
  });
});

// ─── Bulk Approve ───────────────────────────────────────────────────

describe('approvalsApiExtended.bulkApprove', () => {
  it('calls POST /api/approvals/bulk-approve with approval IDs', async () => {
    const mockResult = {
      approved_count: 3,
      failed_count: 0,
      results: [
        { approval_id: 'appr-1', status: 'approved' },
        { approval_id: 'appr-2', status: 'approved' },
        { approval_id: 'appr-3', status: 'approved' },
      ],
    };
    mockPost.mockResolvedValue(mockResult);

    const result = await approvalsApiExtended.bulkApprove(['appr-1', 'appr-2', 'appr-3']);

    expect(mockPost).toHaveBeenCalledWith('/api/approvals/bulk-approve', {
      approval_ids: ['appr-1', 'appr-2', 'appr-3'],
      comments: undefined,
    });
    expect((result as any).approved_count).toBe(3);
  });

  it('includes optional comments in bulk approve request', async () => {
    mockPost.mockResolvedValue({ approved_count: 2 });

    await approvalsApiExtended.bulkApprove(['appr-1', 'appr-2'], 'All verified, approved');

    expect(mockPost).toHaveBeenCalledWith('/api/approvals/bulk-approve', {
      approval_ids: ['appr-1', 'appr-2'],
      comments: 'All verified, approved',
    });
  });

  it('handles partial failure in bulk approve', async () => {
    const mockResult = {
      approved_count: 2,
      failed_count: 1,
      results: [
        { approval_id: 'appr-1', status: 'approved' },
        { approval_id: 'appr-2', status: 'approved' },
        { approval_id: 'appr-3', status: 'failed', error: 'Already approved' },
      ],
    };
    mockPost.mockResolvedValue(mockResult);

    const result = await approvalsApiExtended.bulkApprove(['appr-1', 'appr-2', 'appr-3']);
    expect((result as any).failed_count).toBe(1);
  });
});
