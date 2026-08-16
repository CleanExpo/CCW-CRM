import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserById: vi.fn(),
  updateLastLogin: vi.fn(),
}));

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/jwt-tokens', () => ({
  verifyMfaChallengeToken: vi.fn(),
  signTokenPair: vi.fn().mockResolvedValue({
    access_token: 'access',
    refresh_token: 'refresh',
  }),
}));

vi.mock('@/lib/auth/mfa-totp', () => ({
  beginMfaEnrollment: vi.fn(),
  confirmMfaEnrollment: vi.fn(),
  verifyUserMfa: vi.fn(),
}));

vi.mock('@/lib/auth/session-cookies', () => ({
  setAuthSessionCookies: vi.fn(),
}));

import { POST as confirmMfa } from '@/app/api/auth/mfa/confirm/route';
import { POST as setupMfa } from '@/app/api/auth/mfa/setup/route';
import { POST as verifyMfa } from '@/app/api/auth/mfa/verify/route';
import { findAppUserById, updateLastLogin } from '@/lib/auth/app-user-repo';
import { signTokenPair, verifyMfaChallengeToken } from '@/lib/auth/jwt-tokens';
import { beginMfaEnrollment, confirmMfaEnrollment, verifyUserMfa } from '@/lib/auth/mfa-totp';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';

function jsonPost(url: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('MFA routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts enrollment from an enroll challenge and returns otpauth material', async () => {
    vi.mocked(verifyMfaChallengeToken).mockResolvedValue({
      sub: 'user-1',
      email: 'ops@example.com',
      purpose: 'enroll',
    });
    vi.mocked(beginMfaEnrollment).mockResolvedValue({
      secret: 'SECRETBASE32',
      otpauth_uri: 'otpauth://totp/Optix:ops@example.com?secret=SECRETBASE32',
      recovery_codes: ['AAAA-1111'],
    });

    const res = await setupMfa(jsonPost('/api/auth/mfa/setup', { mfa_token: 'challenge-token' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(beginMfaEnrollment).toHaveBeenCalledWith('user-1', 'ops@example.com');
    expect(body.otpauth_uri).toMatch(/^otpauth:\/\//);
    expect(body.secret).toBe('SECRETBASE32');
    expect(body.recovery_codes).toEqual(['AAAA-1111']);
  });

  it('rejects setup when the challenge is for verify instead of enroll', async () => {
    vi.mocked(verifyMfaChallengeToken).mockResolvedValue({
      sub: 'user-1',
      email: 'ops@example.com',
      purpose: 'verify',
    });

    const res = await setupMfa(jsonPost('/api/auth/mfa/setup', { mfa_token: 'wrong-purpose' }));
    expect(res.status).toBe(401);
    expect(beginMfaEnrollment).not.toHaveBeenCalled();
  });

  it('confirms enrollment from a challenge and issues a session', async () => {
    vi.mocked(verifyMfaChallengeToken).mockResolvedValue({
      sub: 'user-1',
      email: 'ops@example.com',
      purpose: 'enroll',
    });
    vi.mocked(confirmMfaEnrollment).mockResolvedValue(true);
    vi.mocked(findAppUserById).mockResolvedValue({
      id: 'user-1',
      email: 'ops@example.com',
      isActive: true,
      isAdmin: false,
      role: 'member',
      fullName: 'Ops',
      workspaceId: 'user-1',
      createdAt: new Date(),
      lastLoginAt: null,
    } as never);

    const res = await confirmMfa(
      jsonPost('/api/auth/mfa/confirm', { mfa_token: 'challenge-token', code: '123456' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(confirmMfaEnrollment).toHaveBeenCalledWith('user-1', '123456');
    expect(updateLastLogin).toHaveBeenCalledWith('user-1');
    expect(signTokenPair).toHaveBeenCalled();
    expect(setAuthSessionCookies).toHaveBeenCalled();
    expect(body.access_token).toBe('access');
    expect(body.enabled).toBe(true);
  });

  it('rejects a wrong TOTP code on confirm', async () => {
    vi.mocked(verifyMfaChallengeToken).mockResolvedValue({
      sub: 'user-1',
      email: 'ops@example.com',
      purpose: 'enroll',
    });
    vi.mocked(confirmMfaEnrollment).mockResolvedValue(false);

    const res = await confirmMfa(
      jsonPost('/api/auth/mfa/confirm', { mfa_token: 'challenge-token', code: '000000' })
    );
    expect(res.status).toBe(400);
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it('verifies TOTP after password and issues a session', async () => {
    vi.mocked(verifyMfaChallengeToken).mockResolvedValue({
      sub: 'user-1',
      email: 'ops@example.com',
      purpose: 'verify',
    });
    vi.mocked(verifyUserMfa).mockResolvedValue('totp');
    vi.mocked(findAppUserById).mockResolvedValue({
      id: 'user-1',
      email: 'ops@example.com',
      isActive: true,
      isAdmin: false,
      role: 'member',
      fullName: 'Ops',
      workspaceId: 'user-1',
      createdAt: new Date(),
      lastLoginAt: null,
    } as never);

    const res = await verifyMfa(
      jsonPost('/api/auth/mfa/verify', { mfa_token: 'challenge-token', code: '123456' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mfa_method).toBe('totp');
    expect(body.access_token).toBe('access');
    expect(setAuthSessionCookies).toHaveBeenCalled();
  });

  it('rejects an invalid authenticator code on verify', async () => {
    vi.mocked(verifyMfaChallengeToken).mockResolvedValue({
      sub: 'user-1',
      email: 'ops@example.com',
      purpose: 'verify',
    });
    vi.mocked(verifyUserMfa).mockResolvedValue(null);

    const res = await verifyMfa(
      jsonPost('/api/auth/mfa/verify', { mfa_token: 'challenge-token', code: '000000' })
    );
    expect(res.status).toBe(401);
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });
});
