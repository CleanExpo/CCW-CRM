import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserById: vi.fn(),
}));
vi.mock('@/lib/auth/jwt-tokens', () => ({
  verifyAccessJwt: vi.fn(),
}));

import { findAppUserById } from '@/lib/auth/app-user-repo';
import { verifyAccessJwt } from '@/lib/auth/jwt-tokens';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';

describe('getAuthClaimsFromRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the cookie session when a stale member Bearer is also present', async () => {
    vi.mocked(verifyAccessJwt).mockImplementation(async (token: string) => {
      if (token === 'cookie-owner') {
        return {
          sub: 'owner-1',
          email: 'owner@example.test',
          is_admin: true,
          role: 'owner',
          session_version: 0,
        };
      }
      return {
        sub: 'member-1',
        email: 'member@example.test',
        is_admin: false,
        role: 'member',
        session_version: 0,
      };
    });
    vi.mocked(findAppUserById).mockResolvedValue({
      id: 'owner-1',
      email: 'owner@example.test',
      isActive: true,
      isAdmin: true,
      role: 'owner',
      sessionVersion: 0,
    } as never);

    const claims = await getAuthClaimsFromRequest(
      new NextRequest('http://localhost/api/phase2/compare?area=2', {
        headers: {
          cookie: 'auth_token=cookie-owner',
          authorization: 'Bearer stale-member',
        },
      })
    );

    expect(claims).toMatchObject({ sub: 'owner-1', role: 'owner', is_admin: true });
    expect(verifyAccessJwt).toHaveBeenCalledWith('cookie-owner');
  });

  it('takes role and isAdmin from the live user row, not the JWT', async () => {
    vi.mocked(verifyAccessJwt).mockResolvedValue({
      sub: 'user-1',
      email: 'ops@example.test',
      is_admin: false,
      role: 'member',
      session_version: 0,
    });
    vi.mocked(findAppUserById).mockResolvedValue({
      id: 'user-1',
      email: 'ops@example.test',
      isActive: true,
      isAdmin: true,
      role: 'admin',
      sessionVersion: 0,
    } as never);

    const claims = await getAuthClaimsFromRequest(
      new NextRequest('http://localhost/api/phase2/compare', {
        headers: { authorization: 'Bearer jwt' },
      })
    );

    expect(claims).toMatchObject({ role: 'admin', is_admin: true });
  });
});
