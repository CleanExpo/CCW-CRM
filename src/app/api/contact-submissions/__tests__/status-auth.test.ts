import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    contactSubmission: {
      update: vi.fn(),
    },
  },
}));

import { PATCH as patchSubmissionStatus } from '@/app/api/contact-submissions/[id]/status/route';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';

const ADMIN = { userId: 'u-admin', role: 'admin' as const, isAdmin: true };
const MEMBER = { userId: 'u-member', role: 'member' as const, isAdmin: false };

/** A submission belonging to workspace A. No caller from workspace B may change its status. */
const ROW = {
  id: 'cs-1',
  name: 'Workspace A Lead',
  email: 'lead@workspace-a.test',
  phone: null,
  subject: null,
  message: 'private enquiry',
  source: 'portal',
  status: 'contacted',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const statusRequest = () =>
  new NextRequest('http://localhost/api/contact-submissions/cs-1/status', {
    method: 'PATCH',
    body: JSON.stringify({ status: 'contacted' }),
    headers: { 'content-type': 'application/json' },
  });
const detailContext = () => ({ params: Promise.resolve({ id: 'cs-1' }) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.contactSubmission.update).mockResolvedValue(ROW as never);
});

/**
 * This route MUTATES. A status-code-only assertion would still pass if the row were
 * written before the refusal was returned, so every refusal also asserts `update`
 * was never called.
 */
describe('PATCH /api/contact-submissions/[id]/status', () => {
  it('refuses an unauthenticated caller with 401 and never writes the row', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);

    const res = await patchSubmissionStatus(statusRequest(), detailContext());

    expect(res.status).toBe(401);
    expect(prisma.contactSubmission.update).not.toHaveBeenCalled();
  });

  it('refuses an authenticated non-admin with 403 and never writes the row', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(MEMBER);

    const res = await patchSubmissionStatus(statusRequest(), detailContext());

    expect(res.status).toBe(403);
    expect(prisma.contactSubmission.update).not.toHaveBeenCalled();
  });

  it('serves an admin caller', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(ADMIN);

    const res = await patchSubmissionStatus(statusRequest(), detailContext());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'cs-1', status: 'contacted' });
    expect(prisma.contactSubmission.update).toHaveBeenCalledTimes(1);
  });
});
