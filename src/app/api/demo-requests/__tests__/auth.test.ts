import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    demoRequest: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { PATCH as patchDemoRequestStatus } from '@/app/api/demo-requests/[id]/status/route';
import { GET as getDemoRequestById } from '@/app/api/demo-requests/[id]/route';
import { GET as listDemoRequests } from '@/app/api/demo-requests/route';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';

const ADMIN = { userId: 'u-admin', role: 'admin' as const, isAdmin: true };
const MEMBER = { userId: 'u-member', role: 'member' as const, isAdmin: false };

/** A demo request belonging to workspace A. No caller from workspace B may read or change it. */
const ROW = {
  id: 'dr-1',
  name: 'Workspace A Lead',
  email: 'lead@workspace-a.test',
  company: 'Workspace A Pty Ltd',
  phone: '0400 000 000',
  message: 'private enquiry',
  preferredDate: new Date('2026-02-01T00:00:00Z'),
  status: 'pending',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const listRequest = () => new NextRequest('http://localhost/api/demo-requests');
const detailRequest = () => new NextRequest('http://localhost/api/demo-requests/dr-1');
const statusRequest = () =>
  new NextRequest('http://localhost/api/demo-requests/dr-1/status', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'scheduled' }),
    headers: { 'content-type': 'application/json' },
  });
const detailContext = () => ({ params: Promise.resolve({ id: 'dr-1' }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.demoRequest.findMany).mockResolvedValue([ROW] as never);
  vi.mocked(prisma.demoRequest.count).mockResolvedValue(1 as never);
  vi.mocked(prisma.demoRequest.findUnique).mockResolvedValue(ROW as never);
  vi.mocked(prisma.demoRequest.update).mockResolvedValue({
    ...ROW,
    status: 'scheduled',
  } as never);
});

describe('GET /api/demo-requests', () => {
  it('refuses an unauthenticated caller with 401 and never reads the table', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);

    const res = await listDemoRequests(listRequest());

    expect(res.status).toBe(401);
    expect(prisma.demoRequest.findMany).not.toHaveBeenCalled();
  });

  it('refuses an authenticated non-admin with 403 and never reads the table', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(MEMBER);

    const res = await listDemoRequests(listRequest());

    expect(res.status).toBe(403);
    expect(prisma.demoRequest.findMany).not.toHaveBeenCalled();
  });

  it('serves an admin caller', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(ADMIN);

    const res = await listDemoRequests(listRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total: 1 });
  });
});

describe('GET /api/demo-requests/[id]', () => {
  it('refuses an unauthenticated caller with 401 and never reads the row', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);

    const res = await getDemoRequestById(detailRequest(), detailContext());

    expect(res.status).toBe(401);
    expect(prisma.demoRequest.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an authenticated non-admin with 403 and never reads the row', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(MEMBER);

    const res = await getDemoRequestById(detailRequest(), detailContext());

    expect(res.status).toBe(403);
    expect(prisma.demoRequest.findUnique).not.toHaveBeenCalled();
  });

  it('serves an admin caller', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(ADMIN);

    const res = await getDemoRequestById(detailRequest(), detailContext());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'dr-1' });
  });
});

/**
 * This route MUTATES. A status-code-only assertion would still pass if the row were
 * written before the refusal was returned, so every refusal also asserts `update`
 * was never called.
 */
describe('PATCH /api/demo-requests/[id]/status', () => {
  it('refuses an unauthenticated caller with 401 and never writes the row', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);

    const res = await patchDemoRequestStatus(statusRequest(), detailContext());

    expect(res.status).toBe(401);
    expect(prisma.demoRequest.update).not.toHaveBeenCalled();
  });

  it('refuses an authenticated non-admin with 403 and never writes the row', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(MEMBER);

    const res = await patchDemoRequestStatus(statusRequest(), detailContext());

    expect(res.status).toBe(403);
    expect(prisma.demoRequest.update).not.toHaveBeenCalled();
  });

  it('serves an admin caller', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(ADMIN);

    const res = await patchDemoRequestStatus(statusRequest(), detailContext());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'dr-1', status: 'scheduled' });
    expect(prisma.demoRequest.update).toHaveBeenCalledTimes(1);
  });
});
