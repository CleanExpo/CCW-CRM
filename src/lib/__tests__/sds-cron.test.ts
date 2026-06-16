/**
 * SDS review-due cron tests.
 * The cron route is a thin proxy (like check-sla-breaches) — tests cover:
 * - 401 when CRON_SECRET missing/wrong
 * - proxy call when upstream base is available
 * - 500 on network error
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockRequireUpstreamBase = vi.fn();
vi.mock('@/lib/api/upstream-proxy', () => ({
  requireUpstreamBase: (...a: unknown[]) => mockRequireUpstreamBase(...a),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GET } from '@/app/api/cron/sds-review-due/route';

function makeRequest(authHeader?: string): Request {
  return new Request('http://localhost/api/cron/sds-review-due', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('GET /api/cron/sds-review-due', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV, CRON_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns 401 when no authorization header', async () => {
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);
  });

  it('returns 401 when wrong secret', async () => {
    const res = await GET(makeRequest('Bearer wrong-secret') as never);
    expect(res.status).toBe(401);
  });

  it('proxies to upstream and returns success payload', async () => {
    const upstreamBase = 'https://api.example.com';
    mockRequireUpstreamBase.mockReturnValue(upstreamBase);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ flagged: 3, notifications_sent: 3 }),
    });

    const res = await GET(makeRequest('Bearer test-secret') as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.flagged).toBe(3);
    expect(mockFetch).toHaveBeenCalledWith(
      `${upstreamBase}/api/cron/sds-review-due`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns 500 on upstream network error', async () => {
    mockRequireUpstreamBase.mockReturnValue('https://api.example.com');
    mockFetch.mockRejectedValue(new Error('network failure'));

    const res = await GET(makeRequest('Bearer test-secret') as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('network failure');
  });
});
