import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

const findFirst = vi.fn();
const findMany = vi.fn();
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    cin7NightlySyncLedger: {
      findFirst: (...args: unknown[]) => findFirst(...args),
    },
    cin7SyncRun: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

const getCin7SchedulerSnapshot = vi.fn();
vi.mock('@/lib/integrations/cin7-server-scheduler', () => ({
  getCin7SchedulerSnapshot: (...args: unknown[]) => getCin7SchedulerSnapshot(...args),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { GET } from '../route';

describe('GET /api/integrations/cin7/scheduled-sync', () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset().mockResolvedValue([]);
    getCin7SchedulerSnapshot.mockReset().mockReturnValue({
      nextFireAt: new Date('2026-08-17T11:00:00.000Z'),
      running: false,
      actorUserId: 'owner-1',
    });
    vi.mocked(requireAuthScope).mockResolvedValue({
      userId: 'owner-1',
      role: 'owner',
      isAdmin: true,
    } as never);
  });

  it('returns the next server fire time without starting a walk', async () => {
    findFirst.mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/api/integrations/cin7/scheduled-sync'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe('server');
    expect(body.schedule.kind).toBe('twice-daily');
    expect(body.running).toBe(false);
    expect(body.next_fire_at).toBe('2026-08-17T11:00:00.000Z');
  });

  it('surfaces a running sequential walk from the ledger', async () => {
    getCin7SchedulerSnapshot.mockReturnValue({
      nextFireAt: new Date('2026-08-17T11:00:00.000Z'),
      running: true,
      actorUserId: 'owner-1',
    });
    findFirst.mockResolvedValue({
      id: 'led-1',
      startedAt: new Date('2026-08-17T11:00:00.000Z'),
      finishedAt: null,
      overallStatus: 'running',
      consecutiveCompleteCount: 0,
      entityResults: { products: { complete: true, status: 'complete', records: 10 } },
    });

    const response = await GET(new NextRequest('http://localhost/api/integrations/cin7/scheduled-sync'));
    const body = await response.json();

    expect(body.running).toBe(true);
    expect(body.current_entity).toBe('customers');
    expect(body.last_run.id).toBe('led-1');
  });
});
