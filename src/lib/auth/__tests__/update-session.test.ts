// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/jwt-tokens', () => ({
  verifyAuthAccessJwt: vi.fn(),
}));

import { updateSession } from '@/lib/auth/update-session';

const originalCronSecret = process.env.CRON_SECRET;

const runUnauthenticatedRequest = (path: string, authorization?: string) =>
  updateSession(
    new NextRequest(`https://ccw.example${path}`, {
      headers: authorization ? { authorization } : undefined,
    })
  );

const expectLoginRedirect = (response: Response, path: string) => {
  expect(response.status).toBe(307);
  const location = new URL(response.headers.get('location')!);
  expect(location.pathname).toBe('/login');
  expect(location.searchParams.get('redirect')).toBe(path);
};

describe('middleware public-path matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it.each([
    '/playground',
    '/playground/example',
    '/dashboard-analytics',
    '/dashboard-analytics/example',
  ])('redirects unauthenticated access to protected dashboard route %s', async (path) => {
    expectLoginRedirect(await runUnauthenticatedRequest(path), path);
  });

  it.each(['/api/public', '/api/public/stats'])(
    'keeps intended public API route %s accessible without a session',
    async (path) => {
      const response = await runUnauthenticatedRequest(path);

      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    }
  );

  it.each(['/api/cron', '/api/cron/daily-report'])(
    'accepts cron route %s without a session when its bearer secret is valid',
    async (path) => {
      const response = await runUnauthenticatedRequest(path, 'Bearer test-cron-secret');

      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    }
  );

  it.each([undefined, 'Bearer wrong-secret', 'Bearer undefined'])(
    'rejects cron access when authorization is %s',
    async (authorization) => {
      if (authorization === 'Bearer undefined') {
        delete process.env.CRON_SECRET;
      }

      const response = await runUnauthenticatedRequest('/api/cron/daily-report', authorization);

      expect(response.status).toBe(401);
    }
  );

  it.each(['/api/publicity', '/api/publicity/stats', '/api/cronology', '/api/cronology/job'])(
    'does not treat lookalike API route %s as public',
    async (path) => {
      expectLoginRedirect(await runUnauthenticatedRequest(path), path);
    }
  );
});
