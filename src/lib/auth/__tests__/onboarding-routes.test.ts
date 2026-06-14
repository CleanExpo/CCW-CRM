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
import { POST as registerPost } from '@/app/api/auth/register/route';
import { POST as forgotPasswordPost } from '@/app/api/auth/forgot-password/route';

describe('auth onboarding routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('register creates the first user as owner', async () => {
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

    expect(res.status).toBe(200);
    expect(insertAppUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'owner', is_admin: true })
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
