import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/integrations/cin7-server-scheduled-sync', () => ({
  runCin7ScheduledSyncJob: vi.fn().mockResolvedValue({ skipped: false, cin7_complete: true }),
}));

import {
  CIN7_SCHEDULED_SYNC_DEFAULT,
  CIN7_SCHEDULED_SYNC_ENTITY_ORDER,
  CIN7_SCHEDULE_ACTIVE_POLL_MS,
  CIN7_SCHEDULE_IDLE_POLL_MAX_MS,
  CIN7_SYNC_TEST_DELAY_MS,
  cin7EntityCompletionFingerprint,
  cin7ScheduleStatusPollDelayMs,
  getCin7ScheduledSyncRaw,
  getNextCin7ProductionFireAt,
  getNextCin7ScheduledFireAt,
  isCin7ScheduledContactEntity,
  isCin7ServerSchedulerArmed,
  isCin7SyncTestDelayEnabled,
  ledgerCoversFireSlot,
  parseCin7ScheduledSyncAt,
  shouldRestartCin7ScheduledEntity,
} from '@/lib/integrations/cin7-scheduled-sync';
import { runCin7SequentialEntityWalk } from '@/lib/integrations/cin7-sequential-sync';
import { runCin7ScheduledSyncJob } from '@/lib/integrations/cin7-server-scheduled-sync';
import {
  getCin7SchedulerSnapshot,
  registerCin7ScheduledSyncRunner,
  rememberCin7SyncActor,
  resetCin7ScheduleForTests,
  startCin7ServerScheduler,
} from '@/lib/integrations/cin7-server-scheduler';

describe('Cin7 scheduled entity policy', () => {
  it('walks the same entities as the Sync buttons, products first', () => {
    expect([...CIN7_SCHEDULED_SYNC_ENTITY_ORDER]).toEqual([
      'products',
      'customers',
      'internal-customers',
      'suppliers',
      'branches',
      'warehouses',
      'product-categories',
      'brands',
      'price-lists',
      'tax-codes',
      'units-of-measure',
      'stock-levels',
      'orders',
      'inventory',
    ]);
  });

  it('restarts only when there is no prior run or the prior run completed', () => {
    expect(shouldRestartCin7ScheduledEntity(null)).toBe(true);
    expect(shouldRestartCin7ScheduledEntity('complete')).toBe(true);
    expect(shouldRestartCin7ScheduledEntity('incomplete')).toBe(false);
    expect(shouldRestartCin7ScheduledEntity('failed')).toBe(false);
    expect(shouldRestartCin7ScheduledEntity('running')).toBe(false);
  });

  it('forces a full contact walk for customers, internal customers, and suppliers', () => {
    expect(isCin7ScheduledContactEntity('customers')).toBe(true);
    expect(isCin7ScheduledContactEntity('internal-customers')).toBe(true);
    expect(isCin7ScheduledContactEntity('suppliers')).toBe(true);
    expect(isCin7ScheduledContactEntity('products')).toBe(false);
    expect(isCin7ScheduledContactEntity('stock-levels')).toBe(false);
  });

  it('is armed without CRON_SECRET', () => {
    const secret = process.env.CRON_SECRET;
    const owner = process.env.CRON_INTEGRATION_USER_ID;
    delete process.env.CRON_SECRET;
    delete process.env.CRON_INTEGRATION_USER_ID;
    try {
      expect(isCin7ServerSchedulerArmed()).toBe(true);
    } finally {
      if (secret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = secret;
      if (owner === undefined) delete process.env.CRON_INTEGRATION_USER_ID;
      else process.env.CRON_INTEGRATION_USER_ID = owner;
    }
  });
});

describe('Cin7 schedule parsing', () => {
  afterEach(() => {
    delete process.env.CIN7_SCHEDULED_SYNC_AT;
    delete process.env.NEXT_PUBLIC_CIN7_SCHEDULED_SYNC_AT;
  });

  it('defaults to 21:00 Australia/Sydney', () => {
    expect(getCin7ScheduledSyncRaw()).toBe(CIN7_SCHEDULED_SYNC_DEFAULT);
    expect(parseCin7ScheduledSyncAt(CIN7_SCHEDULED_SYNC_DEFAULT)).toMatchObject({
      kind: 'daily',
      hour: 21,
      minute: 0,
      timeZone: 'Australia/Sydney',
    });
  });

  it('prefers CIN7_SCHEDULED_SYNC_AT over the legacy public env', () => {
    process.env.NEXT_PUBLIC_CIN7_SCHEDULED_SYNC_AT = '08:00';
    process.env.CIN7_SCHEDULED_SYNC_AT = '21:30';
    expect(getCin7ScheduledSyncRaw()).toBe('21:30');
  });

  it('does not catch up a one-shot more than two minutes late', () => {
    const spec = parseCin7ScheduledSyncAt('2026-08-17T11:00:00.000Z');
    expect(spec?.kind).toBe('once');
    expect(getNextCin7ScheduledFireAt(spec!, new Date('2026-08-17T11:05:00.000Z'))).toBeNull();
  });

  it('treats a ledger started at the slot as already covering that fire', () => {
    const fireAt = new Date('2026-08-17T11:00:00.000Z');
    expect(ledgerCoversFireSlot(new Date('2026-08-17T11:00:01.000Z'), fireAt)).toBe(true);
    expect(ledgerCoversFireSlot(new Date('2026-08-17T10:59:00.000Z'), fireAt)).toBe(false);
  });

  it('polls the status API slowly while idle and faster only when a walk is due or running', () => {
    const now = new Date('2026-08-17T00:00:00.000Z');
    expect(
      cin7ScheduleStatusPollDelayMs({
        running: true,
        nextFireAt: new Date('2026-08-17T11:00:00.000Z'),
        now,
      })
    ).toBe(CIN7_SCHEDULE_ACTIVE_POLL_MS);
    expect(
      cin7ScheduleStatusPollDelayMs({
        running: false,
        nextFireAt: new Date('2026-08-17T11:00:00.000Z'),
        now,
      })
    ).toBe(CIN7_SCHEDULE_IDLE_POLL_MAX_MS);
    expect(
      cin7ScheduleStatusPollDelayMs({
        running: false,
        nextFireAt: new Date('2026-08-17T00:00:03.000Z'),
        now,
      })
    ).toBe(CIN7_SCHEDULE_ACTIVE_POLL_MS);
  });

  it('fingerprints entity completion, not per-record ticks', () => {
    const runningProducts = cin7EntityCompletionFingerprint({
      running: true,
      currentEntity: 'products',
      lastRunId: 'led-1',
      lastRunStatus: 'running',
      entityStatuses: [{ entity: 'products', status: 'running' }],
    });
    const stillRunningMoreRecords = cin7EntityCompletionFingerprint({
      running: true,
      currentEntity: 'products',
      lastRunId: 'led-1',
      lastRunStatus: 'running',
      entityStatuses: [{ entity: 'products', status: 'running' }],
    });
    const productsDone = cin7EntityCompletionFingerprint({
      running: true,
      currentEntity: 'customers',
      lastRunId: 'led-1',
      lastRunStatus: 'running',
      entityStatuses: [
        { entity: 'products', status: 'complete' },
        { entity: 'customers', status: 'running' },
      ],
    });
    expect(runningProducts).toBe(stillRunningMoreRecords);
    expect(productsDone).not.toBe(runningProducts);
  });
});

describe('runCin7SequentialEntityWalk', () => {
  it('posts one entity at a time, full= on contacts, restart after complete', async () => {
    const calls: Array<{ entity: string; restart: boolean; full: boolean }> = [];
    const prior: Record<string, string | null> = {
      products: 'complete',
      customers: 'incomplete',
    };
    let inFlight = 0;
    let maxInFlight = 0;

    const walk = await runCin7SequentialEntityWalk({
      loadPriorStatus: async (entity) => prior[entity] ?? 'complete',
      postChunk: async (entity, opts) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        calls.push({ entity, restart: opts.restart, full: opts.full });
        inFlight -= 1;
        return { status: 'complete', complete: true, records_processed: 1, last_committed_page: 1 };
      },
      sleep: async () => undefined,
    });

    expect(maxInFlight).toBe(1);
    expect(calls.map((c) => c.entity)).toEqual([...CIN7_SCHEDULED_SYNC_ENTITY_ORDER]);
    expect(calls[0]).toEqual({ entity: 'products', restart: true, full: false });
    expect(calls[1]).toEqual({ entity: 'customers', restart: false, full: true });
    expect(calls.find((c) => c.entity === 'internal-customers')).toMatchObject({ full: true });
    expect(calls.find((c) => c.entity === 'suppliers')).toMatchObject({ full: true });
    expect(calls.find((c) => c.entity === 'stock-levels')).toMatchObject({
      full: false,
      restart: true,
    });
    expect(walk.cin7AllComplete).toBe(true);
    expect(walk.order).toEqual(CIN7_SCHEDULED_SYNC_ENTITY_ORDER);
  });

  it('stops an entity when a chunk is incomplete without a next page', async () => {
    const walk = await runCin7SequentialEntityWalk({
      loadPriorStatus: async () => 'incomplete',
      postChunk: async (entity) => {
        if (entity === 'products') {
          return { status: 'failed', complete: false, records_processed: 3 };
        }
        return { status: 'complete', complete: true, records_processed: 1 };
      },
      sleep: async () => undefined,
    });

    expect(walk.entityResults.products?.complete).toBe(false);
    expect(walk.cin7AllComplete).toBe(false);
    expect(walk.entityResults.customers?.complete).toBe(true);
  });
});

describe('Cin7 test-delay switch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses a 5-minute first run on next dev even when CIN7_SYNC_TEST_DELAY=false', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('CIN7_SYNC_TEST_DELAY', 'false');
    expect(isCin7SyncTestDelayEnabled()).toBe(true);
  });

  it('keeps production on 5:00 AM / 9:00 PM unless the test delay is forced on', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CIN7_SYNC_TEST_DELAY', 'false');
    expect(isCin7SyncTestDelayEnabled()).toBe(false);
    vi.stubEnv('CIN7_SYNC_TEST_DELAY', 'true');
    expect(isCin7SyncTestDelayEnabled()).toBe(true);
  });
});

describe('Cin7 production clock (Australia/Sydney)', () => {
  function sydneyHour(date: Date): number {
    return Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Sydney',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(date)
    );
  }

  it('chooses 5:00 AM Sydney when the morning slot is still ahead', () => {
    const from = new Date('2026-08-16T18:00:00.000Z');
    const next = getNextCin7ProductionFireAt(from);
    expect(sydneyHour(next)).toBe(5);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it('chooses 9:00 PM Sydney after the morning slot has passed', () => {
    const from = new Date('2026-08-16T20:00:00.000Z');
    const next = getNextCin7ProductionFireAt(from);
    expect(sydneyHour(next)).toBe(21);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it('rolls to 5:00 AM the next Sydney morning after 9:00 PM', () => {
    const from = new Date('2026-08-17T12:00:00.000Z');
    const next = getNextCin7ProductionFireAt(from);
    expect(sydneyHour(next)).toBe(5);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe('in-process Cin7 scheduler', () => {
  afterEach(() => {
    resetCin7ScheduleForTests();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('arms a 5-minute test run then walks entities in-process when it fires', async () => {
    vi.stubEnv('CIN7_SYNC_TEST_DELAY', 'true');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T00:00:00.000Z'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(runCin7ScheduledSyncJob).mockClear();
    registerCin7ScheduledSyncRunner(runCin7ScheduledSyncJob);

    startCin7ServerScheduler();
    const first = getCin7SchedulerSnapshot();
    expect(first.nextFireAt?.getTime()).toBe(Date.now() + CIN7_SYNC_TEST_DELAY_MS);

    await vi.advanceTimersByTimeAsync(CIN7_SYNC_TEST_DELAY_MS);
    expect(runCin7ScheduledSyncJob).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    const after = getCin7SchedulerSnapshot();
    expect(after.nextFireAt).toBeTruthy();
    expect(after.nextFireAt!.getTime()).toBeGreaterThan(Date.now() + CIN7_SYNC_TEST_DELAY_MS);
  });

  it('remembers the signed-in actor without starting a walk', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    rememberCin7SyncActor('owner-1');
    expect(getCin7SchedulerSnapshot().actorUserId).toBe('owner-1');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
