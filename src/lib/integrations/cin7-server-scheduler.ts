/**
 * In-process Cin7 scheduler.
 * Fires once per day at 9:00 PM Australia/Sydney and walks every entity
 * until complete. No test delay. No cron user. No schedule table.
 */

import {
  CIN7_SYNC_SCHEDULE_LABEL,
  formatCin7SyncWhen,
  getNextCin7ProductionFireAt,
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

function arm(at: Date): void {
  clearTimer();
  nextFireAt = at;
  const delay = Math.max(0, at.getTime() - Date.now());
  console.log(
    `[cin7-scheduler] next run ${at.toISOString()} (${formatCin7SyncWhen(at)}) in ${Math.round(delay / 1000)}s [${CIN7_SYNC_SCHEDULE_LABEL}]`
  );
  timer = setTimeout(() => {
    timer = null;
    void triggerScheduledSync();
  }, delay);
  timer.unref?.();
}

function armNextSlot(): void {
  arm(getNextCin7ProductionFireAt(new Date()));
}

async function triggerScheduledSync(): Promise<void> {
  console.log('[cin7-scheduler] triggered');
  if (running) {
    console.log('[cin7-scheduler] skipped: a sync is already running');
    armNextSlot();
    return;
  }

  // Arm tomorrow's 9:00 PM before the walk so a long sync cannot skip it.
  armNextSlot();

  if (!runJob) {
    console.error('[cin7-scheduler] skipped: sync job is not registered (Node boot did not load)');
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
  console.log(`[cin7-scheduler] starting — daily ${CIN7_SYNC_SCHEDULE_LABEL}`);
  armNextSlot();
}

export function resetCin7ScheduleForTests(): void {
  clearTimer();
  nextFireAt = null;
  running = false;
  actorUserId = null;
  started = false;
  runJob = null;
}
