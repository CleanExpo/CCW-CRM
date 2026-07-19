/**
 * Toby onboarding: register and forgot-password routes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserByEmail: vi.fn(),
  countAppUsers: vi.fn(),
  insertAppUser: vi.fn(),
  setPasswordResetFields: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

vi.mock('@/lib/auth/jwt-tokens', () => ({
  signTokenPair: vi.fn().mockResolvedValue({
    access_token: 'access',
    refresh_token: 'refresh',
  }),
}));

vi.mock('@/lib/auth/session-cookies', () => ({
  setAuthSessionCookies: vi.fn(),
}));

import {
  countAppUsers,
  findAppUserByEmail,
  insertAppUser,
  setPasswordResetFields,
} from '@/lib/auth/app-user-repo';
import { signTokenPair } from '@/lib/auth/jwt-tokens';
import { hashPassword } from '@/lib/auth/password';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { POST as forgotPasswordPost } from '@/app/api/auth/forgot-password/route';

describe('auth onboarding routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register denies anonymous account creation before any user or token work', async () => {
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(countAppUsers).mockResolvedValue(0);
    vi.mocked(insertAppUser).mockResolvedValue({
      id: 'u-new',
      email: 'owner@example.com',
      isAdmin: true,
      role: 'owner',
      fullName: 'Owner',
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
          email: 'owner@example.com',
          password: 'Password123!',
          full_name: 'Owner',
        }),
      })
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      detail: 'Public registration is disabled. Ask an owner or admin for an invitation.',
    });
    expect(findAppUserByEmail).not.toHaveBeenCalled();
    expect(countAppUsers).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    expect(insertAppUser).not.toHaveBeenCalled();
    expect(signTokenPair).not.toHaveBeenCalled();
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
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
