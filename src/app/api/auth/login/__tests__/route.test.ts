import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserByEmail: vi.fn(),
  updateLastLogin: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({
  verifyPassword: vi.fn(),
}));

vi.mock('@/lib/auth/jwt-tokens', () => ({
  signMfaChallengeToken: vi.fn().mockResolvedValue('mfa-challenge'),
  signTokenPair: vi.fn().mockResolvedValue({
    access_token: 'access',
    refresh_token: 'refresh',
  }),
}));

vi.mock('@/lib/auth/session-cookies', () => ({
  setAuthSessionCookies: vi.fn(),
}));

const rememberCin7SyncActor = vi.fn();
vi.mock('@/lib/integrations/cin7-server-scheduler', () => ({
  rememberCin7SyncActor: (...args: unknown[]) => rememberCin7SyncActor(...args),
}));

import { findAppUserByEmail, updateLastLogin } from '@/lib/auth/app-user-repo';
import { verifyPassword } from '@/lib/auth/password';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';
import { POST } from '../route';

function loginPost(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const member = {
  id: 'user-1',
  email: 'ops@example.com',
  passwordHash: 'hashed',
  isActive: true,
  isAdmin: false,
  totpEnabled: false,
  role: 'member',
  fullName: 'Ops',
  workspaceId: 'user-1',
  createdAt: new Date(),
  lastLoginAt: null,
};

describe('POST /api/auth/login Cin7 refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MFA_ENFORCE', 'false');
    vi.mocked(findAppUserByEmail).mockResolvedValue(member as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('queues one Cin7 sync after a successful session is issued', async () => {
    const res = await POST(loginPost({ email: 'ops@example.com', password: 'Password123!' }));

    expect(res.status).toBe(200);
    expect(setAuthSessionCookies).toHaveBeenCalled();
    expect(updateLastLogin).toHaveBeenCalledWith('user-1');
    expect(rememberCin7SyncActor).toHaveBeenCalledWith('user-1');
  });

  it('does not queue a Cin7 sync when the password is wrong', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const res = await POST(loginPost({ email: 'ops@example.com', password: 'nope' }));

    expect(res.status).toBe(401);
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
    expect(rememberCin7SyncActor).not.toHaveBeenCalled();
  });

  it('does not queue a Cin7 sync when MFA still has to be completed', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue({
      ...member,
      totpEnabled: true,
    } as never);

    const res = await POST(loginPost({ email: 'ops@example.com', password: 'Password123!' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mfa_required).toBe(true);
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
    expect(rememberCin7SyncActor).not.toHaveBeenCalled();
  });
});
