/**
 * PR #214 hardening: phone-agent routes require auth and workspace on writes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/ccw-workspace-context', () => ({
  resolveCcwWorkspaceContext: vi.fn(),
  ccwWorkspaceRecordOwnerId: vi.fn((ctx: { workspaceId: string }) => ctx.workspaceId),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    ccwAddonFeatureConfig: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    ccwFollowUpAction: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    ccwFollowUpRule: {
      findFirst: vi.fn(),
    },
    ccwAiCallSession: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/phone-agent/ccw-phone-agent-status', () => ({
  getCcwPhoneAgentPilotStatus: vi.fn(() => ({
    ready_for_inbound_pilot: false,
    missing_configuration: [],
  })),
}));

vi.mock('@/lib/phone-agent/phone-agent-config', () => ({
  buildCcwPhoneAgentConfigResponse: vi.fn(() => ({ config: {}, status: 'disabled' })),
  normaliseCcwPhoneAgentConfigInput: vi.fn((body: unknown, defaults: unknown) => ({
    status: 'disabled',
    config: defaults,
    ...(body as object),
  })),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { resolveCcwWorkspaceContext } from '@/lib/auth/ccw-workspace-context';
import { prisma } from '@/lib/db/prisma';
import { GET as configGet, PUT as configPut } from '@/app/api/phone-agent/config/route';
import { POST as followUpActionPost } from '@/app/api/phone-agent/follow-up-actions/route';

const AUTH = { userId: 'user-1', role: 'owner' as const, isAdmin: true };
const CTX = { workspaceId: 'ws-1', workspaceUserIds: ['ws-1', 'user-1'], actingUserId: 'user-1' };

function setAuthenticated(withWorkspace = true) {
  vi.mocked(requireAuthScope).mockResolvedValue(AUTH);
  vi.mocked(resolveCcwWorkspaceContext).mockResolvedValue(withWorkspace ? CTX : null);
}

describe('phone-agent route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('config GET returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    const res = await configGet(new Request('http://localhost/api/phone-agent/config') as never);
    expect(res.status).toBe(401);
  });

  it('config GET returns 403 without workspace', async () => {
    setAuthenticated(false);
    const res = await configGet(new Request('http://localhost/api/phone-agent/config') as never);
    expect(res.status).toBe(403);
  });

  it('config PUT returns 403 without workspace', async () => {
    setAuthenticated(false);
    const res = await configPut(
      new Request('http://localhost/api/phone-agent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'enabled' }),
      }) as never
    );
    expect(res.status).toBe(403);
  });

  it('config PUT upserts with workspace owner id', async () => {
    setAuthenticated();
    vi.mocked(prisma.ccwAddonFeatureConfig.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.ccwAddonFeatureConfig.upsert).mockResolvedValue({
      status: 'enabled',
      config: {},
    } as never);

    const res = await configPut(
      new Request('http://localhost/api/phone-agent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'enabled' }),
      }) as never
    );
    expect(res.status).toBe(200);
    expect(prisma.ccwAddonFeatureConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerUserId_featureSlug: { ownerUserId: 'ws-1', featureSlug: 'ccw_ai_phone_agent' },
        },
        create: expect.objectContaining({ ownerUserId: 'ws-1' }),
      })
    );
  });

  it('follow-up action POST rejects foreign call session', async () => {
    setAuthenticated();
    vi.mocked(prisma.ccwAiCallSession.findFirst).mockResolvedValue(null);

    const res = await followUpActionPost(
      new Request('http://localhost/api/phone-agent/follow-up-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Hello',
          call_session_id: 'foreign-session',
        }),
      }) as never
    );
    expect(res.status).toBe(404);
  });
});
