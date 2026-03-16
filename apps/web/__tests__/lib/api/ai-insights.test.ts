import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { generateInsights, getDashboardInsights, getInsightHistory } from '@/lib/api/ai-insights';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateInsights', () => {
  it('calls POST /api/ai/insights/generate', async () => {
    mockPost.mockResolvedValue({ category: 'sales', insights: [], total_insights: 0 });
    await generateInsights({ category: 'sales' });
    expect(mockPost).toHaveBeenCalledWith('/api/ai/insights/generate', { category: 'sales' });
  });

  it('passes date_range and filters', async () => {
    mockPost.mockResolvedValue({ category: 'all', insights: [] });
    const request = {
      category: 'all' as const,
      date_range: { start_date: '2026-01-01', end_date: '2026-03-01' },
      filters: { region: 'AU' },
    };
    await generateInsights(request);
    expect(mockPost).toHaveBeenCalledWith('/api/ai/insights/generate', request);
  });
});

describe('getDashboardInsights', () => {
  it('calls GET with default limit 10', async () => {
    mockGet.mockResolvedValue({ insights: [], total: 0, categories: [] });
    await getDashboardInsights();
    expect(mockGet).toHaveBeenCalledWith('/api/ai/insights/dashboard?limit=10');
  });

  it('accepts custom limit', async () => {
    mockGet.mockResolvedValue({ insights: [], total: 0, categories: [] });
    await getDashboardInsights(5);
    expect(mockGet).toHaveBeenCalledWith('/api/ai/insights/dashboard?limit=5');
  });
});

describe('getInsightHistory', () => {
  it('calls GET with default page and page_size', async () => {
    mockGet.mockResolvedValue({ insights: [], total: 0, page: 1, page_size: 20 });
    await getInsightHistory();
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('page=1');
    expect(url).toContain('page_size=20');
  });

  it('appends category and priority filters', async () => {
    mockGet.mockResolvedValue({ insights: [], total: 0 });
    await getInsightHistory('sales', 'high', 2, 10);
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('category=sales');
    expect(url).toContain('priority=high');
    expect(url).toContain('page=2');
    expect(url).toContain('page_size=10');
  });
});
