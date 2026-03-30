import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { shadowApi } from '@/lib/api/shadow';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPatch = vi.mocked(apiClient.patch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shadowApi.getStatus', () => {
  it('calls /api/shadow/status', async () => {
    mockGet.mockResolvedValue({ active: false, session: null, day_number: 0, days_remaining: 0, readiness_score: null });
    await shadowApi.getStatus();
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/status');
  });
});

describe('shadowApi.getActiveSession', () => {
  it('calls /api/shadow/session', async () => {
    mockGet.mockResolvedValue(null);
    await shadowApi.getActiveSession();
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/session');
  });
});

describe('shadowApi.startSession', () => {
  it('posts to /api/shadow/session with request body', async () => {
    mockPost.mockResolvedValue({ id: 'sess-1', status: 'active' });
    await shadowApi.startSession({ client_name: 'Acme', duration_days: 30 });
    expect(mockPost).toHaveBeenCalledWith('/api/shadow/session', {
      client_name: 'Acme',
      duration_days: 30,
    });
  });
});

describe('shadowApi.endSession', () => {
  it('patches session end endpoint', async () => {
    mockPatch.mockResolvedValue({ id: 'sess-1', status: 'completed' });
    await shadowApi.endSession('sess-1');
    expect(mockPatch).toHaveBeenCalledWith('/api/shadow/session/sess-1/end', {});
  });
});

describe('shadowApi.getReadinessScore', () => {
  it('calls /api/shadow/readiness-score', async () => {
    mockGet.mockResolvedValue({ score: 75, breakdown: {}, recommendation: 'Almost ready', ready_for_transition: false });
    await shadowApi.getReadinessScore();
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/readiness-score');
  });
});

describe('shadowApi.getDailyStats', () => {
  it('defaults to 30 days', async () => {
    mockGet.mockResolvedValue({ session_id: 's-1', day_count: 30, stats: [] });
    await shadowApi.getDailyStats();
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/daily-stats?days=30');
  });

  it('accepts custom days param', async () => {
    mockGet.mockResolvedValue({ session_id: 's-1', day_count: 7, stats: [] });
    await shadowApi.getDailyStats(7);
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/daily-stats?days=7');
  });
});

describe('shadowApi.getTransitionReport', () => {
  it('calls /api/shadow/transition-report', async () => {
    mockGet.mockResolvedValue({ session_id: 's-1', score: 80, ready_for_transition: true, report_markdown: '# Report', generated_at: '2026-01-01' });
    await shadowApi.getTransitionReport();
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/transition-report');
  });
});

describe('shadowApi.getPatterns', () => {
  it('defaults to limit 20', async () => {
    mockGet.mockResolvedValue({ count: 0, patterns: [] });
    await shadowApi.getPatterns();
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/patterns?limit=20');
  });

  it('accepts custom limit', async () => {
    mockGet.mockResolvedValue({ count: 0, patterns: [] });
    await shadowApi.getPatterns(5);
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/patterns?limit=5');
  });
});

describe('shadowApi.getGaps', () => {
  it('calls gaps endpoint with no filters', async () => {
    mockGet.mockResolvedValue({ total: 0, items: [] });
    await shadowApi.getGaps();
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/gaps?');
  });

  it('appends severity filter when provided', async () => {
    mockGet.mockResolvedValue({ total: 2, items: [] });
    await shadowApi.getGaps({ severity: 'high' });
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/gaps?severity=high');
  });
});

describe('shadowApi.getAiOpportunities', () => {
  it('calls /api/shadow/ai-opportunities', async () => {
    mockGet.mockResolvedValue({ count: 0, opportunities: [] });
    await shadowApi.getAiOpportunities();
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/ai-opportunities');
  });
});

describe('shadowApi.getComparison', () => {
  it('defaults entity_type to order', async () => {
    mockGet.mockResolvedValue({ entity_type: 'order', total_observed: 0, match_rate: 0, distribution: {}, interpretation: '' });
    await shadowApi.getComparison();
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/comparison?entity_type=order');
  });

  it('accepts custom entity_type', async () => {
    mockGet.mockResolvedValue({ entity_type: 'product' });
    await shadowApi.getComparison('product');
    expect(mockGet).toHaveBeenCalledWith('/api/shadow/comparison?entity_type=product');
  });
});
