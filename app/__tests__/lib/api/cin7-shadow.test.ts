import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import {
  triggerShadowPoll,
  getShadowStatus,
  listSyncGaps,
  getSyncGapsSummary,
  updateGapStatus,
} from '@/lib/api/cin7-shadow';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);

beforeEach(() => vi.clearAllMocks());

describe('triggerShadowPoll', () => {
  it('calls POST /api/cin7/shadow/poll', async () => {
    mockPost.mockResolvedValue({ polled: 50 });
    await triggerShadowPoll();
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/shadow/poll');
  });
});

describe('getShadowStatus', () => {
  it('calls GET /api/cin7/shadow/status', async () => {
    mockGet.mockResolvedValue({ status: 'healthy' });
    await getShadowStatus();
    expect(mockGet).toHaveBeenCalledWith('/api/cin7/shadow/status');
  });
});

describe('listSyncGaps', () => {
  it('calls GET /api/cin7/shadow/gaps', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await listSyncGaps();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/shadow/gaps'));
  });
});

describe('getSyncGapsSummary', () => {
  it('calls GET /api/cin7/shadow/gaps/summary', async () => {
    mockGet.mockResolvedValue({ total_gaps: 0 });
    await getSyncGapsSummary();
    expect(mockGet).toHaveBeenCalledWith('/api/cin7/shadow/gaps/summary');
  });
});

describe('updateGapStatus', () => {
  it('calls PATCH /api/cin7/shadow/gaps/:id', async () => {
    mockPatch.mockResolvedValue({ id: 'gap-1', status: 'resolved' });
    await updateGapStatus('gap-1', 'resolved' as never, 'Fixed manually');
    expect(mockPatch).toHaveBeenCalledWith(
      '/api/cin7/shadow/gaps/gap-1',
      expect.objectContaining({ status: 'resolved' })
    );
  });
});
