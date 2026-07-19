// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/request-token', () => ({
  getAuthClaimsFromRequest: vi.fn(),
}));

vi.mock('@/lib/auth/app-user-repo', () => ({
  findAppUserByEmail: vi.fn(),
  findAppUserById: vi.fn(),
  insertAppUser: vi.fn(),
}));

vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-temporary-password'),
}));

import { POST as invitePost } from '@/app/api/team/invite/route';
import { findAppUserByEmail, findAppUserById, insertAppUser } from '@/lib/auth/app-user-repo';
import { hashPassword } from '@/lib/auth/password';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';

const inviteRequest = () =>
  new NextRequest('http://localhost/api/team/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'new.member@example.com',
      full_name: 'New Member',
      role: 'member',
    }),
  });

const claimsFor = (role: 'owner' | 'admin' | 'member' | 'billing') => ({
  sub: `${role}-1`,
  email: `${role}@example.com`,
  is_admin: role === 'owner' || role === 'admin',
  role,
});

describe('team invite role matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findAppUserById).mockResolvedValue({
      id: 'inviter-1',
      isActive: true,
      workspaceId: 'workspace-1',
    } as never);
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockResolvedValue({
      id: 'new-user-1',
      email: 'new.member@example.com',
      isAdmin: false,
      role: 'member',
      fullName: 'New Member',
      isActive: true,
      workspaceId: 'workspace-1',
      createdAt: new Date(),
      lastLoginAt: null,
    } as never);
  });

  it.each(['owner', 'admin'] as const)('allows authenticated %s invitations', async (role) => {
    vi.mocked(getAuthClaimsFromRequest).mockResolvedValue(claimsFor(role));

    const response = await invitePost(inviteRequest());

    expect(response.status).toBe(201);
    expect(hashPassword).toHaveBeenCalledOnce();
    expect(insertAppUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new.member@example.com',
        role: 'member',
        workspace_id: 'workspace-1',
      })
    );
  });

  it.each(['member', 'billing'] as const)('denies authenticated %s invitations', async (role) => {
    vi.mocked(getAuthClaimsFromRequest).mockResolvedValue(claimsFor(role));

    const response = await invitePost(inviteRequest());

    expect(response.status).toBe(403);
    expect(findAppUserById).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    expect(insertAppUser).not.toHaveBeenCalled();
  });
});
