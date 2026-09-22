/**
 * UNI-2724: POST /api/integrations/cin7/scheduled-sync/run starts a full Cin7
 * walk. It must refuse anonymous callers and anyone below owner/admin.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScopeOrCronIntegrationJob: vi.fn(),
}));

const runJob = vi.fn();
vi.mock('@/lib/integrations/cin7-server-scheduled-sync', () => ({
  runCin7ScheduledSyncJob: (...args: unknown[]) => runJob(...args),
}));

import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import { POST } from '../run/route';

const post = () =>
  POST(
    new NextRequest('http://localhost/api/integrations/cin7/scheduled-sync/run', {
      method: 'POST',
    })
  );

function actAs(role: 'owner' | 'admin' | 'member' | 'billing' | null) {
  vi.mocked(requireAuthScopeOrCronIntegrationJob).mockResolvedValue(
    role ? { userId: `user-${role}`, role, isAdmin: role === 'owner' || role === 'admin' } : null
  );
}

describe('POST /api/integrations/cin7/scheduled-sync/run', () => {
  beforeEach(() => {
    runJob.mockReset().mockResolvedValue({ skipped: false });
    vi.mocked(requireAuthScopeOrCronIntegrationJob).mockReset();
  });

  it('401 and no walk when unauthenticated', async () => {
    actAs(null);
    const res = await post();
    expect(res.status).toBe(401);
    expect(runJob).not.toHaveBeenCalled();
  });

  it.each(['member', 'billing'] as const)('403 and no walk for %s', async (role) => {
    actAs(role);
    const res = await post();
    expect(res.status).toBe(403);
    expect(runJob).not.toHaveBeenCalled();
  });

  it.each(['owner', 'admin'] as const)('202 and the walk starts for %s', async (role) => {
    actAs(role);
    const res = await post();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true, started: true });
    expect(runJob).toHaveBeenCalledTimes(1);
  });
});
