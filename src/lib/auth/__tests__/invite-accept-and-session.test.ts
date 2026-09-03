import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserById: vi.fn(),
  findAppUserByInviteHash: vi.fn(),
  acceptInvitePassword: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('new-hash'),
}));

vi.mock('@/lib/auth/jwt-tokens', () => ({
  verifyAccessJwt: vi.fn(),
}));

import { acceptInvitePassword, findAppUserById, findAppUserByInviteHash } from '@/lib/auth/app-user-repo';
import { verifyAccessJwt } from '@/lib/auth/jwt-tokens';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import { POST as acceptInvite } from '@/app/api/team/invite/accept/route';

describe('invite accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets a password from the hashed invite token and clears the must-change flag', async () => {
    vi.mocked(findAppUserByInviteHash).mockResolvedValue({
      id: 'invitee-1',
      email: 'invitee@example.com',
      isActive: true,
    } as never);

    const res = await acceptInvite(
      new NextRequest('http://localhost/api/team/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'a'.repeat(24), password: 'NewPass12' }),
      })
    );

    expect(res.status).toBe(200);
    expect(acceptInvitePassword).toHaveBeenCalledWith('invitee-1', 'new-hash');
  });
});

describe('session version', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an access token after sessionVersion is bumped', async () => {
    vi.mocked(verifyAccessJwt).mockResolvedValue({
      sub: 'user-1',
      email: 'ops@example.com',
      is_admin: true,
      role: 'admin',
      session_version: 0,
    });
    vi.mocked(findAppUserById).mockResolvedValue({
      id: 'user-1',
      isActive: true,
      sessionVersion: 1,
    } as never);

    const claims = await getAuthClaimsFromRequest(
      new NextRequest('http://localhost/api/team', {
        headers: { authorization: 'Bearer stale' },
      })
    );

    expect(claims).toBeNull();
  });
});
