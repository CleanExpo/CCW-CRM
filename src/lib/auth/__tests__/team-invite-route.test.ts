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
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

import { POST } from '@/app/api/team/invite/route';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import { findAppUserByEmail, findAppUserById, insertAppUser } from '@/lib/auth/app-user-repo';

function inviteRequest(role: 'owner' | 'admin' | 'member' | 'billing' = 'member') {
  return new NextRequest('http://localhost/api/team/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invitee@example.com', full_name: 'Invitee', role }),
  });
}

describe('team invite route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated provisioning', async () => {
    vi.mocked(getAuthClaimsFromRequest).mockResolvedValue(null);

    const res = await POST(inviteRequest('admin'));

    expect(res.status).toBe(401);
    expect(insertAppUser).not.toHaveBeenCalled();
  });

  it('rejects a stale admin token after the inviter is demoted to member', async () => {
    vi.mocked(getAuthClaimsFromRequest).mockResolvedValue({
      sub: 'former-admin',
      email: 'former-admin@example.com',
      is_admin: true,
      role: 'admin',
    });
    vi.mocked(findAppUserById).mockResolvedValue({
      id: 'former-admin',
      workspaceId: 'workspace-1',
      isActive: true,
      isAdmin: false,
      role: 'member',
    } as never);
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockResolvedValue({
      id: 'invitee-user',
      email: 'invitee@example.com',
      fullName: 'Invitee',
      role: 'admin',
      isAdmin: true,
      isActive: true,
      workspaceId: 'workspace-1',
      createdAt: new Date(),
      lastLoginAt: null,
    } as never);

    const res = await POST(inviteRequest('admin'));

    expect(res.status).toBe(403);
    expect(findAppUserByEmail).not.toHaveBeenCalled();
    expect(insertAppUser).not.toHaveBeenCalled();
  });

  it('keeps privileged provisioning behind an authenticated admin boundary', async () => {
    vi.mocked(getAuthClaimsFromRequest).mockResolvedValue({
      sub: 'admin-user',
      email: 'admin@example.com',
      is_admin: true,
      role: 'admin',
    });
    vi.mocked(findAppUserById).mockResolvedValue({
      id: 'admin-user',
      workspaceId: 'workspace-1',
      isActive: true,
      isAdmin: true,
      role: 'admin',
    } as never);
    vi.mocked(findAppUserByEmail).mockResolvedValue(null);
    vi.mocked(insertAppUser).mockResolvedValue({
      id: 'invitee-user',
      email: 'invitee@example.com',
      fullName: 'Invitee',
      role: 'admin',
      isAdmin: true,
      isActive: true,
      workspaceId: 'workspace-1',
      createdAt: new Date(),
      lastLoginAt: null,
    } as never);

    const res = await POST(inviteRequest('admin'));

    expect(res.status).toBe(201);
    expect(insertAppUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'invitee@example.com',
        role: 'admin',
        is_admin: true,
        workspace_id: 'workspace-1',
      })
    );
  });
});