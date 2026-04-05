import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import {
  analyzeShadowGaps,
  autoResolveStaleShadowGaps,
  getShadowAiHealth,
} from '@/lib/api/cin7-shadow-ai';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

describe('analyzeShadowGaps', () => {
  it('calls GET /api/ai/shadow/analyze', async () => {
    mockGet.mockResolvedValue({ recommendations: [] });
    await analyzeShadowGaps();
    expect(mockGet).toHaveBeenCalledWith('/api/ai/shadow/analyze');
  });
});

describe('autoResolveStaleShadowGaps', () => {
  it('calls POST /api/ai/shadow/auto-resolve', async () => {
    mockPost.mockResolvedValue({ resolved: 3 });
    await autoResolveStaleShadowGaps(30);
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('/api/ai/shadow/auto-resolve'),
      expect.anything()
    );
  });
});

describe('getShadowAiHealth', () => {
  it('calls GET /api/ai/shadow/health', async () => {
    mockGet.mockResolvedValue({ status: 'healthy' });
    await getShadowAiHealth();
    expect(mockGet).toHaveBeenCalledWith('/api/ai/shadow/health');
  });
});
