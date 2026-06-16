/**
 * PR #214 hardening: feasibility statement creates require workspace and scoped parent lookup.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/ccw-workspace-context', () => ({
  resolveCcwWorkspaceContext: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    ccwFeasibilityStatement: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/feasibility/statement-read-path', () => ({
  findingsPayloadFromMarkdown: vi.fn(() => ({ summary: {}, findings: [] })),
  normaliseCcwFeasibilityStatementSeed: vi.fn((body: Record<string, unknown>) => ({
    title: String(body.title ?? 'Test'),
    objective: String(body.objective ?? 'Objective'),
    content_markdown: null,
    parent_statement_id: body.parent_statement_id ?? null,
  })),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { resolveCcwWorkspaceContext } from '@/lib/auth/ccw-workspace-context';
import { prisma } from '@/lib/db/prisma';
import { POST as statementPost } from '@/app/api/addons/ccw-feasibility-ai/statements/route';

const AUTH = { userId: 'user-1', role: 'owner' as const, isAdmin: true };
const CTX = { workspaceId: 'ws-1', workspaceUserIds: ['ws-1', 'user-1', 'user-2'], actingUserId: 'user-1' };

describe('feasibility statement route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuthScope).mockResolvedValue(AUTH);
    vi.mocked(resolveCcwWorkspaceContext).mockResolvedValue(CTX);
  });

  it('POST returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    const res = await statementPost(
      new Request('http://localhost/api/addons/ccw-feasibility-ai/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'A', objective: 'B' }),
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it('POST returns 403 without workspace', async () => {
    vi.mocked(resolveCcwWorkspaceContext).mockResolvedValue(null);
    const res = await statementPost(
      new Request('http://localhost/api/addons/ccw-feasibility-ai/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'A', objective: 'B' }),
      }) as never
    );
    expect(res.status).toBe(403);
  });

  it('POST parent lookup uses workspace member ids', async () => {
    vi.mocked(prisma.ccwFeasibilityStatement.findFirst).mockResolvedValue(null);

    const res = await statementPost(
      new Request('http://localhost/api/addons/ccw-feasibility-ai/statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Child',
          objective: 'Fork',
          parent_statement_id: 'parent-1',
        }),
      }) as never
    );
    expect(res.status).toBe(404);
    expect(prisma.ccwFeasibilityStatement.findFirst).toHaveBeenCalledWith({
      where: { id: 'parent-1', ownerUserId: { in: CTX.workspaceUserIds } },
      select: { id: true },
    });
  });
});
