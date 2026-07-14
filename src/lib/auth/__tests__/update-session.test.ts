// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/jwt-tokens', () => ({
  verifyAuthAccessJwt: vi.fn(),
}));

import { updateSession } from '@/lib/auth/update-session';

const runUnauthenticatedRequest = (path: string) =>
  updateSession(new NextRequest(`https://ccw.example${path}`));

const expectLoginRedirect = (response: Response, path: string) => {
  expect(response.status).toBe(307);
  const location = new URL(response.headers.get('location')!);
  expect(location.pathname).toBe('/login');
  expect(location.searchParams.get('redirect')).toBe(path);
};

describe('middleware public-path matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['/playground', '/dashboard-analytics'])(
    'redirects unauthenticated access to protected dashboard route %s',
    async (path) => {
      expectLoginRedirect(await runUnauthenticatedRequest(path), path);
    }
  );

  it.each([
    '/api/public',
    '/api/public/stats',
    '/api/cron',
    '/api/cron/daily-report',
  ])('keeps intended public API route %s accessible without a session', async (path) => {
    const response = await runUnauthenticatedRequest(path);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it.each(['/api/publicity', '/api/cronology'])(
    'does not treat lookalike API route %s as public',
    async (path) => {
      expectLoginRedirect(await runUnauthenticatedRequest(path), path);
    }
  );
});
