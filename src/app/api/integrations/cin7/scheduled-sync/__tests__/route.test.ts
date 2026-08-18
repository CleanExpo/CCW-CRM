import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

const findFirstLedger = vi.fn();
const findFirstSync = vi.fn();
const findMany = vi.fn();
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    cin7NightlySyncLedger: {
      findFirst: (...args: unknown[]) => findFirstLedger(...args),
    },
    cin7SyncRun: {
      findMany: (...args: unknown[]) => findMany(...args),
      findFirst: (...args: unknown[]) => findFirstSync(...args),
    },
  },
}));

const getCin7SchedulerSnapshot = vi.fn();
vi.mock('@/lib/integrations/cin7-server-scheduler', () => ({
  getCin7SchedulerSnapshot: (...args: unknown[]) => getCin7SchedulerSnapshot(...args),
}));

vi.mock('@/lib/integrations/cin7-server-scheduled-sync', () => ({
  recoverStaleCin7NightlyLedgers: vi.fn().mockResolvedValue(0),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { GET } from '../route';

describe('GET /api/integrations/cin7/scheduled-sync', () => {
  beforeEach(() => {
    findFirstLedger.mockReset();
    findFirstSync.mockReset().mockResolvedValue(null);
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
    findFirstLedger.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/integrations/cin7/scheduled-sync')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe('server');
    expect(body.schedule.kind).toBe('daily');
    expect(body.schedule.raw).toBe('21:00');
    expect(body.note).toContain('9:00 PM Australia/Sydney');
    expect(body.note).not.toContain('5:00 AM');
    expect(body.note).not.toContain('5 minutes');
    expect(body.running).toBe(false);
    expect(body.next_fire_at).toBe('2026-08-17T11:00:00.000Z');
  });

  it('surfaces a running sequential walk from the ledger', async () => {
    getCin7SchedulerSnapshot.mockReturnValue({
      nextFireAt: new Date('2026-08-17T11:00:00.000Z'),
      running: true,
      actorUserId: 'owner-1',
    });
    findFirstLedger.mockResolvedValue({
      id: 'led-1',
      startedAt: new Date('2026-08-17T11:00:00.000Z'),
      finishedAt: null,
      overallStatus: 'running',
      consecutiveCompleteCount: 0,
      entityResults: { products: { complete: true, status: 'complete', records: 10 } },
    });
    findFirstSync.mockResolvedValue({ updatedAt: new Date('2026-08-17T11:01:00.000Z') });

    const response = await GET(
      new NextRequest('http://localhost/api/integrations/cin7/scheduled-sync')
    );
    const body = await response.json();

    expect(body.running).toBe(true);
    expect(body.current_entity).toBe('customers');
    expect(body.last_run.id).toBe('led-1');
  });

  it('does not treat a leftover running ledger as tonight’s walk', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T03:35:00.000Z'));
    findFirstLedger.mockResolvedValue({
      id: 'b60bc393-101c-420f-bb3d-4fcc587a22d6',
      startedAt: new Date('2026-08-17T12:49:01.326Z'),
      finishedAt: null,
      overallStatus: 'running',
      consecutiveCompleteCount: 0,
      entityResults: {},
    });
    findFirstSync.mockResolvedValue({ updatedAt: new Date('2026-08-17T22:12:49.516Z') });

    const response = await GET(
      new NextRequest('http://localhost/api/integrations/cin7/scheduled-sync')
    );
    const body = await response.json();
    try {
      expect(body.running).toBe(false);
      expect(body.current_entity).toBeNull();
      expect(body.note).toContain('9:00 PM Australia/Sydney');
    } finally {
      vi.useRealTimers();
    }
  });
});
