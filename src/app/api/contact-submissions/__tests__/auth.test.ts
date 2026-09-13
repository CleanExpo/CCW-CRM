import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    contactSubmission: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { GET as getSubmissionById } from '@/app/api/contact-submissions/[id]/route';
import { GET as listSubmissions } from '@/app/api/contact-submissions/route';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';

const ADMIN = { userId: 'u-admin', role: 'admin' as const, isAdmin: true };
const MEMBER = { userId: 'u-member', role: 'member' as const, isAdmin: false };

/** A submission belonging to workspace A. No caller from workspace B may see it. */
const ROW = {
  id: 'cs-1',
  name: 'Workspace A Lead',
  email: 'lead@workspace-a.test',
  phone: null,
  subject: null,
  message: 'private enquiry',
  source: 'portal',
  status: 'new',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const listRequest = () => new NextRequest('http://localhost/api/contact-submissions');
const detailRequest = () => new NextRequest('http://localhost/api/contact-submissions/cs-1');
const detailContext = () => ({ params: Promise.resolve({ id: 'cs-1' }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.contactSubmission.findMany).mockResolvedValue([ROW] as never);
  vi.mocked(prisma.contactSubmission.count).mockResolvedValue(1 as never);
  vi.mocked(prisma.contactSubmission.findUnique).mockResolvedValue(ROW as never);
});

describe('GET /api/contact-submissions', () => {
  it('refuses an unauthenticated caller with 401 and never reads the table', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);

    const res = await listSubmissions(listRequest());

    expect(res.status).toBe(401);
    expect(prisma.contactSubmission.findMany).not.toHaveBeenCalled();
  });

  it('refuses an authenticated non-admin with 403 and never reads the table', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(MEMBER);

    const res = await listSubmissions(listRequest());

    expect(res.status).toBe(403);
    expect(prisma.contactSubmission.findMany).not.toHaveBeenCalled();
  });

  it('serves an admin caller', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(ADMIN);

    const res = await listSubmissions(listRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total: 1 });
  });
});

describe('GET /api/contact-submissions/[id]', () => {
  it('refuses an unauthenticated caller with 401 and never reads the row', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);

    const res = await getSubmissionById(detailRequest(), detailContext());

    expect(res.status).toBe(401);
    expect(prisma.contactSubmission.findUnique).not.toHaveBeenCalled();
  });

  it('refuses an authenticated non-admin with 403 and never reads the row', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(MEMBER);

    const res = await getSubmissionById(detailRequest(), detailContext());

    expect(res.status).toBe(403);
    expect(prisma.contactSubmission.findUnique).not.toHaveBeenCalled();
  });

  it('serves an admin caller', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(ADMIN);

    const res = await getSubmissionById(detailRequest(), detailContext());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'cs-1' });
  });
});
