/** UNI-2749: the call-outcome route rejects a malformed request before touching data. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(async () => ({ userId: 'user-a', role: 'member', isAdmin: false })),
}));
vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(async () => ['user-a']),
}));
vi.mock('@/lib/reorder-radar/radar-service', async (orig) => {
  const real = await orig<typeof import('@/lib/reorder-radar/radar-service')>();
  return {
    ...real,
    logCallOutcome: vi.fn(async () => ({ id: 'a1', subject: 'Reorder call: Ordered' })),
  };
});

import { logCallOutcome } from '@/lib/reorder-radar/radar-service';
import { POST } from '@/app/api/crm/reorder-radar/calls/route';

const post = (body: string) =>
  POST(new NextRequest('http://localhost/api/crm/reorder-radar/calls', { method: 'POST', body }));

beforeEach(() => vi.mocked(logCallOutcome).mockClear());

describe('POST /api/crm/reorder-radar/calls', () => {
  it('400 when customer_id is missing, empty or the body is not JSON', async () => {
    for (const body of [
      '{"outcome":"ordered"}',
      '{"customer_id":"","outcome":"ordered"}',
      'not json',
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(logCallOutcome).not.toHaveBeenCalled();
  });

  it('positive control: a well-formed call is logged', async () => {
    expect((await post('{"customer_id":"c30","outcome":"ordered"}')).status).toBe(201);
    expect(logCallOutcome).toHaveBeenCalledTimes(1);
  });
});
