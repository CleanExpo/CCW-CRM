import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserByEmail: vi.fn(),
  countAppUsers: vi.fn(),
  insertAppUser: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

// A module factory REPLACES the module, so every export the route imports must appear here.
// `signMfaChallengeToken` was missing after a7f4d1db added it to the route: the call resolved to
// undefined, threw, and the route's catch turned every registration into a 503. The tests failed
// for a reason that had nothing to do with what they assert.
vi.mock('@/lib/auth/jwt-tokens', () => ({
  signTokenPair: vi.fn().mockResolvedValue({
    access_token: 'access',
    refresh_token: 'refresh',
  }),
  signMfaChallengeToken: vi.fn().mockResolvedValue('mfa-challenge'),
}));

vi.mock('@/lib/auth/session-cookies', () => ({
  setAuthSessionCookies: vi.fn(),
}));

import { POST as registerPost } from '@/app/api/auth/register/route';
import { countAppUsers, findAppUserByEmail, insertAppUser } from '@/lib/auth/app-user-repo';
import { signMfaChallengeToken, signTokenPair } from '@/lib/auth/jwt-tokens';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';

function registerRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function memberRow(email: string, id = 'u-member') {
  return {
    id,
    email,
    isAdmin: false,
    role: 'member' as const,
    fullName: 'Member',
    isActive: true,
    workspaceId: id,
    createdAt: new Date(),
    lastLoginAt: null,
  };
}

describe('public registration privilege boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates an ordinary public user with least privilege', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockResolvedValue(memberRow('member@example.com') as never);

    const res = await registerPost(
      registerRequest({
        email: 'member@example.com',
        password: 'Password123!',
        full_name: 'Member',
      })
    );

    expect(res.status).toBe(200);
    expect(insertAppUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'member', is_admin: false })
    );
    // MFA enrollment is enforced by default (`roleRequiresMfa` is true unless MFA_ENFORCE is
    // 'false'), so registration issues a short-lived enrollment challenge for the PERSISTED
    // identity — not a session.
    expect(signMfaChallengeToken).toHaveBeenCalledWith('u-member', 'member@example.com', 'enroll');
    expect(signTokenPair).not.toHaveBeenCalled();
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it('ignores forged privilege fields and signs persisted member claims', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockResolvedValue(
      memberRow('forged@example.com', 'u-forged') as never
    );

    const res = await registerPost(
      registerRequest({
        email: 'forged@example.com',
        password: 'Password123!',
        full_name: 'Forged',
        role: 'owner',
        is_admin: true,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(insertAppUser).toHaveBeenCalledWith({
      email: 'forged@example.com',
      password_hash: 'hashed',
      full_name: 'Forged',
      role: 'member',
      is_admin: false,
    });
    // The challenge is signed for the persisted row, so forged `role`/`is_admin` in the request
    // body cannot reach the token even indirectly.
    expect(signMfaChallengeToken).toHaveBeenCalledWith(
      'u-forged',
      'forged@example.com',
      'enroll'
    );
    expect(body.user).toMatchObject({ role: 'member', is_admin: false });
    // No session exists until MFA completes: no access token in the body, and no cookies set.
    expect(body.access_token).toBeUndefined();
    expect(body.mfa_enrollment_required).toBe(true);
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  // The assertions above only exercise the enrollment path. When MFA_ENFORCE is 'false' the route
  // takes the OTHER exit — the one that actually mints a session and sets cookies — so that is the
  // exit where a forged claim could reach a token. Without this case the privilege boundary has no
  // regression test on the branch that issues credentials.
  it('signs persisted claims, not forged body claims, when MFA enforcement is off', async () => {
    vi.stubEnv('MFA_ENFORCE', 'false');
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockResolvedValue(
      memberRow('session@example.com', 'u-session') as never
    );

    const res = await registerPost(
      registerRequest({
        email: 'session@example.com',
        password: 'Password123!',
        full_name: 'Session',
        role: 'owner',
        is_admin: true,
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    // This exit issues a session rather than a challenge.
    expect(signMfaChallengeToken).not.toHaveBeenCalled();
    expect(setAuthSessionCookies).toHaveBeenCalled();
    // The token must carry the PERSISTED identity. Signing `is_admin: true` / `role: 'owner'` from
    // the request body is exactly the escalation this asserts against.
    expect(signTokenPair).toHaveBeenCalledWith('u-session', 'session@example.com', false, 'member');
    expect(body.user).toMatchObject({ role: 'member', is_admin: false });
  });

  it('parallel public registrations cannot race into privileged claims', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockImplementation(async (input) => ({
      ...memberRow(input.email.toLowerCase(), `u-${input.email}`),
      fullName: input.full_name,
      isAdmin: input.is_admin,
      role: input.role ?? 'member',
    }) as never);

    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        registerPost(
          registerRequest({
            email: `parallel-${index}@example.com`,
            password: 'Password123!',
          })
        )
      )
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(countAppUsers).not.toHaveBeenCalled();
    expect(insertAppUser).toHaveBeenCalledTimes(8);
    for (const [input] of vi.mocked(insertAppUser).mock.calls) {
      expect(input).toMatchObject({ role: 'member', is_admin: false });
    }
    // Every parallel registration must land on the enrollment challenge, never on a session.
    expect(signMfaChallengeToken).toHaveBeenCalledTimes(8);
    for (const [, , purpose] of vi.mocked(signMfaChallengeToken).mock.calls) {
      expect(purpose).toBe('enroll');
    }
    expect(signTokenPair).not.toHaveBeenCalled();
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it('maps a concurrent normalised-email collision to 409', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockRejectedValue({ code: 'P2002' });

    const res = await registerPost(
      registerRequest({
        email: 'Mixed.Case@Example.com',
        password: 'Password123!',
      })
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.detail).toBe('An account with this email already exists');
    expect(signTokenPair).not.toHaveBeenCalled();
  });

  it('emits non-identifying privilege telemetry', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockResolvedValue(memberRow('telemetry@example.com') as never);

    await registerPost(
      registerRequest({
        email: 'telemetry@example.com',
        password: 'Password123!',
      })
    );

    expect(info).toHaveBeenCalledWith('[auth/register] registration completed', {
      role: 'member',
      is_admin: false,
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain('telemetry@example.com');
    info.mockRestore();
  });

  it('does not log internal errors or registration PII', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockRejectedValue(
      new Error('database failure for private.person@example.com')
    );

    const res = await registerPost(
      registerRequest({
        email: 'private.person@example.com',
        password: 'Password123!',
      })
    );

    expect(res.status).toBe(503);
    expect(error).toHaveBeenCalledWith('[auth/register] registration failed', {
      errorType: 'Error',
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain('private.person@example.com');
    expect(JSON.stringify(error.mock.calls)).not.toContain('database failure');
    error.mockRestore();
  });
});
