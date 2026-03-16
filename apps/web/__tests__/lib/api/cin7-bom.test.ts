import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

import {
  listBoms,
  syncBoms,
  getBom,
  listProductionRuns,
  createProductionRun,
  updateProductionRunStatus,
} from '@/lib/api/cin7-bom';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);

beforeEach(() => vi.clearAllMocks());

describe('listBoms', () => {
  it('calls GET /api/cin7/bom', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await listBoms();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/bom'));
  });
});

describe('syncBoms', () => {
  it('calls POST /api/cin7/bom/sync', async () => {
    mockPost.mockResolvedValue({ synced: 5 });
    await syncBoms();
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/bom/sync', expect.anything());
  });
});

describe('getBom', () => {
  it('calls GET /api/cin7/bom/:id', async () => {
    mockGet.mockResolvedValue({ id: 'bom-1' });
    await getBom('bom-1');
    expect(mockGet).toHaveBeenCalledWith('/api/cin7/bom/bom-1');
  });
});

describe('listProductionRuns', () => {
  it('calls GET /api/cin7/bom/production-runs', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await listProductionRuns();
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/cin7/bom/production-runs'));
  });
});

describe('createProductionRun', () => {
  it('calls POST /api/cin7/bom/production-runs', async () => {
    mockPost.mockResolvedValue({ id: 'pr-1' });
    const data = { bom_id: 'bom-1', quantity: 10 };
    await createProductionRun(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/cin7/bom/production-runs', data);
  });
});

describe('updateProductionRunStatus', () => {
  it('calls PATCH /api/cin7/bom/production-runs/:id/status', async () => {
    mockPatch.mockResolvedValue({ id: 'pr-1', status: 'completed' });
    await updateProductionRunStatus('pr-1', { status: 'completed' } as never);
    expect(mockPatch).toHaveBeenCalledWith('/api/cin7/bom/production-runs/pr-1/status', {
      status: 'completed',
    });
  });
});
