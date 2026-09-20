import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));
vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(),
}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    invoice: { findMany: vi.fn() },
    stockMovement: { findMany: vi.fn() },
  },
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { prisma } from '@/lib/db/prisma';
import { GET } from '../route';

describe('GET /api/reporting/extract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkspaceMemberUserIds).mockResolvedValue(['u1']);
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([]);
    vi.mocked(prisma.stockMovement.findMany).mockResolvedValue([]);
  });

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/reporting/extract'));
    expect(res.status).toBe(401);
  });

  it('rejects a member', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue({
      userId: 'u1',
      role: 'member',
      isAdmin: false,
    } as never);
    const res = await GET(new NextRequest('http://localhost/api/reporting/extract'));
    expect(res.status).toBe(403);
  });

  it('returns JSON for an admin', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue({
      userId: 'u1',
      role: 'admin',
      isAdmin: true,
    } as never);
    const res = await GET(new NextRequest('http://localhost/api/reporting/extract'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invoice_lines: unknown[]; stock_movements: unknown[] };
    expect(body.invoice_lines).toEqual([]);
    expect(body.stock_movements).toEqual([]);
  });
});
