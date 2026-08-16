/**
 * Toby onboarding: register and forgot-password routes.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserByEmail: vi.fn(),
  countAppUsers: vi.fn(),
  insertAppUser: vi.fn(),
  setPasswordResetFields: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

// A module factory replaces the module, so every export the routes import must be listed. The
// register route gained `signMfaChallengeToken` in a7f4d1db; without it the call was undefined
// and the route returned 503 for reasons unrelated to what this file asserts.
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

import { POST as forgotPasswordPost } from '@/app/api/auth/forgot-password/route';
import { POST as registerPost } from '@/app/api/auth/register/route';
import {
  countAppUsers,
  findAppUserByEmail,
  insertAppUser,
  setPasswordResetFields,
} from '@/lib/auth/app-user-repo';

describe('auth onboarding routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ALLOW_PUBLIC_REGISTRATION', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('register rejects duplicate email with 409', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      isActive: true,
    } as never);

    const res = await registerPost(
      new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'a@example.com',
          password: 'Password123!',
          full_name: 'Alex',
        }),
      })
    );

    expect(res.status).toBe(409);
  });

  it('register does not bootstrap privilege when the user table is empty', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(countAppUsers).mockResolvedValue(0);
    vi.mocked(insertAppUser).mockResolvedValue({
      id: 'u-new',
      email: 'member@example.com',
      isAdmin: false,
      role: 'member',
      fullName: 'Member',
      isActive: true,
      workspaceId: 'u-new',
      createdAt: new Date(),
      lastLoginAt: null,
    } as never);

    const res = await registerPost(
      new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'member@example.com',
          password: 'Password123!',
          full_name: 'Member',
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(countAppUsers).not.toHaveBeenCalled();
    expect(insertAppUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'member', is_admin: false })
    );
  });

  it('forgot-password returns generic success when email is unknown', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);

    const res = await forgotPasswordPost(
      new NextRequest('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'missing@example.com' }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toMatch(/If an account exists/i);
    expect(setPasswordResetFields).not.toHaveBeenCalled();
  });

  it('forgot-password stores reset token for active users', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      isActive: true,
    } as never);
    vi.mocked(setPasswordResetFields).mockResolvedValue(undefined);

    const res = await forgotPasswordPost(
      new NextRequest('http://localhost/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      })
    );

    expect(res.status).toBe(200);
    expect(setPasswordResetFields).toHaveBeenCalled();
  });
});
