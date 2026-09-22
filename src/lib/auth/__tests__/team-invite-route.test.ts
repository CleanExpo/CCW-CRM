import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/lib/auth/mailtrap-invite', () => ({
  sendTeamInviteViaMailtrap: vi.fn().mockResolvedValue({ ok: true, message_id: 'mt-1' }),
}));

import { POST } from '@/app/api/team/invite/route';
import { findAppUserByEmail, findAppUserById, insertAppUser } from '@/lib/auth/app-user-repo';
import { sendTeamInviteViaMailtrap } from '@/lib/auth/mailtrap-invite';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';

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
      session_version: 0,
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
      session_version: 0,
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
    const body = (await res.json()) as {
      invite?: { delivery?: string; must_set_password?: boolean };
      credentials?: { temporary_password?: string };
    };

    expect(res.status).toBe(201);
    expect(body.credentials?.temporary_password).toBeUndefined();
    expect(body.invite?.delivery).toBe('mailtrap');
    expect(body.invite?.must_set_password).toBe(true);
    expect(insertAppUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'invitee@example.com',
        role: 'admin',
        is_admin: true,
        workspace_id: 'workspace-1',
        must_change_password: true,
      })
    );
    expect(sendTeamInviteViaMailtrap).toHaveBeenCalled();
  });

  it('returns 503 when Mailtrap is not configured instead of emailing a live inbox', async () => {
    vi.mocked(getAuthClaimsFromRequest).mockResolvedValue({
      sub: 'admin-user',
      email: 'admin@example.com',
      is_admin: true,
      role: 'admin',
      session_version: 0,
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
      role: 'member',
      isAdmin: false,
      isActive: true,
      workspaceId: 'workspace-1',
      createdAt: new Date(),
      lastLoginAt: null,
    } as never);
    vi.mocked(sendTeamInviteViaMailtrap).mockResolvedValue({
      ok: false,
      detail: 'MAILTRAP_API_TOKEN and MAILTRAP_INBOX_ID are not configured.',
    });

    const res = await POST(inviteRequest('member'));

    expect(res.status).toBe(503);
  });
});
