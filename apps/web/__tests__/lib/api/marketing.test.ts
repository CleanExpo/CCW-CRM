import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { marketingApi } from '@/lib/api/marketing';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);

beforeEach(() => vi.clearAllMocks());

const mockStats = {
  totalAssets: 84,
  imagesGenerated: 52,
  copyGenerated: 32,
  thisMonth: 14,
};

describe('marketingApi.getStats', () => {
  it('calls GET /api/ai/stats', async () => {
    mockGet.mockResolvedValue(mockStats);
    await marketingApi.getStats();
    expect(mockGet).toHaveBeenCalledWith('/api/ai/stats');
  });

  it('returns marketing stats', async () => {
    mockGet.mockResolvedValue(mockStats);
    const result = await marketingApi.getStats();
    expect(result.totalAssets).toBe(84);
    expect(result.imagesGenerated).toBe(52);
    expect(result.copyGenerated).toBe(32);
    expect(result.thisMonth).toBe(14);
  });

  it('propagates errors from apiClient', async () => {
    mockGet.mockRejectedValue(new Error('Unauthorised'));
    await expect(marketingApi.getStats()).rejects.toThrow('Unauthorised');
  });
});
