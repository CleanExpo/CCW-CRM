/**
 * In-process Cin7 scheduler.
 * Production: 5:00 AM and 9:00 PM Australia/Sydney.
 * Testing: first run 5 minutes after the server starts (NODE_ENV=development
 * or CIN7_SYNC_TEST_DELAY=true). No cron user, no schedule table.
 */

import {
  CIN7_SYNC_TEST_DELAY_MS,
  formatCin7SyncWhen,
  getNextCin7ProductionFireAt,
  isCin7SyncTestDelayEnabled,
} from '@/lib/integrations/cin7-scheduled-sync';

export type Cin7SchedulerSnapshot = {
  nextFireAt: Date | null;
  running: boolean;
  actorUserId: string | null;
};

type Cin7ScheduledSyncRunner = () => Promise<unknown>;

let timer: ReturnType<typeof setTimeout> | null = null;
let nextFireAt: Date | null = null;
let running = false;
let actorUserId: string | null = null;
let usedTestDelay = false;
let started = false;
let runJob: Cin7ScheduledSyncRunner | null = null;

/** Node-only boot wires the Prisma walk here so instrumentation stays browser-safe. */
export function registerCin7ScheduledSyncRunner(fn: Cin7ScheduledSyncRunner): void {
  runJob = fn;
}

function clearTimer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

export function rememberCin7SyncActor(userId: string): void {
  const id = userId.trim();
  if (id) actorUserId = id;
}

export function getCin7SchedulerSnapshot(): Cin7SchedulerSnapshot {
  return { nextFireAt, running, actorUserId };
}

export function isCin7ScheduledSyncRunning(): boolean {
  return running;
}

export function setCin7ScheduledSyncRunning(value: boolean): void {
  running = value;
}

function pickNextFireAt(now: Date): { at: Date; label: string } {
  if (isCin7SyncTestDelayEnabled() && !usedTestDelay) {
    usedTestDelay = true;
    return {
      at: new Date(now.getTime() + CIN7_SYNC_TEST_DELAY_MS),
      label: 'test delay (5 minutes)',
    };
  }
  return {
    at: getNextCin7ProductionFireAt(now),
    label: '5:00 AM / 9:00 PM Australia/Sydney',
  };
}

function arm(at: Date, label: string): void {
  clearTimer();
  nextFireAt = at;
  const delay = Math.max(0, at.getTime() - Date.now());
  console.log(
    `[cin7-scheduler] next run ${at.toISOString()} (${formatCin7SyncWhen(at)}) in ${Math.round(delay / 1000)}s [${label}]`
  );
  timer = setTimeout(() => {
    timer = null;
    void triggerScheduledSync();
  }, delay);
  timer.unref?.();
}

async function triggerScheduledSync(): Promise<void> {
  console.log('[cin7-scheduler] triggered');
  if (running) {
    console.log('[cin7-scheduler] skipped: a sync is already running');
    arm(getNextCin7ProductionFireAt(new Date()), '5:00 AM / 9:00 PM Australia/Sydney');
    return;
  }

  // Arm the next 5:00 AM / 9:00 PM slot before the walk so a long sync cannot skip it.
  arm(getNextCin7ProductionFireAt(new Date()), '5:00 AM / 9:00 PM Australia/Sydney');

  if (!runJob) {
    console.error(
      '[cin7-scheduler] skipped: sync job is not registered (Node boot did not load)'
    );
    return;
  }

  try {
    const result = await runJob();
    console.log('[cin7-scheduler] finished', JSON.stringify(result));
  } catch (error) {
    console.error('[cin7-scheduler] job failed', error instanceof Error ? error.message : error);
  }
}

export function startCin7ServerScheduler(): void {
  if (started) return;
  started = true;
  const test = isCin7SyncTestDelayEnabled();
  console.log(
    test
      ? '[cin7-scheduler] starting — first run in 5 minutes (testing), then 5:00 AM and 9:00 PM Australia/Sydney'
      : '[cin7-scheduler] starting — 5:00 AM and 9:00 PM Australia/Sydney'
  );
  const next = pickNextFireAt(new Date());
  arm(next.at, next.label);
}

export function resetCin7ScheduleForTests(): void {
  clearTimer();
  nextFireAt = null;
  running = false;
  actorUserId = null;
  usedTestDelay = false;
  started = false;
  runJob = null;
}
