/**
 * Shared Cin7 scheduled-sync helpers (schedule + entity order).
 *
 * Firing the walk is server-only (`cin7-server-scheduled-sync`). The browser
 * only displays next/last run from the status API.
 *
 * Schedule formats (Australia/Sydney wall clock unless ISO):
 * - ISO datetime → fire once at that instant
 * - HH:mm or HH:mm:ss → daily
 *
 * Server reads CIN7_SCHEDULED_SYNC_AT, then NEXT_PUBLIC_CIN7_SCHEDULED_SYNC_AT
 * (legacy), then defaults to 21:00.
 */

export const CIN7_SCHEDULED_SYNC_ENV = 'CIN7_SCHEDULED_SYNC_AT';
export const CIN7_SCHEDULED_SYNC_TZ = 'Australia/Sydney';
export const CIN7_SCHEDULED_SYNC_DEFAULT = '21:00';

/** Daily production slot: 9:00 PM Australia/Sydney. */
export const CIN7_SYNC_PRODUCTION_HOUR = 21;
export const CIN7_SYNC_SCHEDULE_LABEL = '9:00 PM Australia/Sydney';

/** Browser event after scheduled sync runs a live Cin7 reconciliation pull. */
export const CIN7_LIVE_RECON_REFRESHED_EVENT = 'cin7:live-recon-refreshed';

export const CIN7_SCHEDULED_SYNC_ENTITY_ORDER = [
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
] as const;

export type Cin7ScheduledSyncEntity = (typeof CIN7_SCHEDULED_SYNC_ENTITY_ORDER)[number];

export type Cin7ScheduleSpec =
  | { kind: 'once'; at: Date; raw: string }
  | { kind: 'daily'; hour: number; minute: number; second: number; timeZone: string; raw: string };

export function isCin7ScheduledContactEntity(entityType: string): boolean {
  return (
    entityType === 'customers' || entityType === 'internal-customers' || entityType === 'suppliers'
  );
}

/**
 * Same rule as the Sync buttons: resume incomplete; restart after a completed sync.
 * `failed` / `running` / missing → resume (not a wipe).
 */
export function shouldRestartCin7ScheduledEntity(priorStatus: string | null | undefined): boolean {
  return !priorStatus || priorStatus === 'complete';
}

export function getCin7CronOwnerUserId(): string | null {
  return process.env.CRON_INTEGRATION_USER_ID?.trim() || null;
}

/** True unless explicitly disabled. No CRON_* env is required. */
export function isCin7ServerSchedulerArmed(): boolean {
  return process.env.CIN7_SERVER_SCHEDULER !== 'false';
}

export function getCin7ScheduledSyncRaw(): string {
  const server = (process.env.CIN7_SCHEDULED_SYNC_AT ?? '').trim();
  if (server) return server;
  const legacy = (process.env.NEXT_PUBLIC_CIN7_SCHEDULED_SYNC_AT ?? '').trim();
  if (legacy) return legacy;
  return CIN7_SCHEDULED_SYNC_DEFAULT;
}

export function parseCin7ScheduledSyncAt(raw: string): Cin7ScheduleSpec | null {
  const value = raw.trim();
  if (!value) return null;

  const daily = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (daily) {
    const hour = Number(daily[1]);
    const minute = Number(daily[2]);
    const second = Number(daily[3] ?? '0');
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      !Number.isInteger(second) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59 ||
      second < 0 ||
      second > 59
    ) {
      return null;
    }
    return {
      kind: 'daily',
      hour,
      minute,
      second,
      timeZone: CIN7_SCHEDULED_SYNC_TZ,
      raw: value,
    };
  }

  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return { kind: 'once', at, raw: value };
}

function zonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Convert a Sydney civil datetime to a UTC Date via binary search on the offset. */
function sydneyWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const p = zonedParts(new Date(guess), CIN7_SCHEDULED_SYNC_TZ);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const target = Date.UTC(year, month - 1, day, hour, minute, second);
    guess += target - asUtc;
  }
  return new Date(guess);
}

/** Next fire time at or after `from` (inclusive within a small grace for once-specs). */
export function getNextCin7ScheduledFireAt(
  spec: Cin7ScheduleSpec,
  from: Date = new Date()
): Date | null {
  if (spec.kind === 'once') {
    if (spec.at.getTime() < from.getTime() - 2 * 60 * 1000) return null;
    return spec.at;
  }

  const nowParts = zonedParts(from, spec.timeZone);
  let candidate = sydneyWallTimeToUtc(
    nowParts.year,
    nowParts.month,
    nowParts.day,
    spec.hour,
    spec.minute,
    spec.second
  );
  if (candidate.getTime() < from.getTime() - 2 * 60 * 1000) {
    const tomorrow = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const t = zonedParts(tomorrow, spec.timeZone);
    candidate = sydneyWallTimeToUtc(t.year, t.month, t.day, spec.hour, spec.minute, spec.second);
  }
  return candidate;
}

function sydneyNinePmOn(parts: {
  year: number;
  month: number;
  day: number;
}): Date {
  return sydneyWallTimeToUtc(parts.year, parts.month, parts.day, CIN7_SYNC_PRODUCTION_HOUR, 0, 0);
}

/** Next 9:00 PM Australia/Sydney strictly after `from`. */
export function getNextCin7ProductionFireAt(from: Date = new Date()): Date {
  const nowParts = zonedParts(from, CIN7_SCHEDULED_SYNC_TZ);
  const today = sydneyNinePmOn(nowParts);
  if (today.getTime() > from.getTime()) return today;
  const tomorrow = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return sydneyNinePmOn(zonedParts(tomorrow, CIN7_SCHEDULED_SYNC_TZ));
}

/** Most recent 9:00 PM Australia/Sydney at or before `from` (today’s slot after it fires). */
export function getCin7ProductionSlotAtOrBefore(from: Date = new Date()): Date {
  const nowParts = zonedParts(from, CIN7_SCHEDULED_SYNC_TZ);
  const today = sydneyNinePmOn(nowParts);
  if (today.getTime() <= from.getTime()) return today;
  const yesterday = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  return sydneyNinePmOn(zonedParts(yesterday, CIN7_SCHEDULED_SYNC_TZ));
}

export function formatCin7SyncWhen(date: Date): string {
  return date.toLocaleString('en-AU', {
    timeZone: CIN7_SCHEDULED_SYNC_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

export function getResolvedCin7Schedule(now: Date = new Date()): {
  spec: Cin7ScheduleSpec;
  nextFireAt: Date | null;
  raw: string;
} {
  const raw = getCin7ScheduledSyncRaw();
  const spec =
    parseCin7ScheduledSyncAt(raw) ?? parseCin7ScheduledSyncAt(CIN7_SCHEDULED_SYNC_DEFAULT)!;
  return { spec, nextFireAt: getNextCin7ScheduledFireAt(spec, now), raw: spec.raw };
}

/** True when a ledger row already covers this fire slot (do not start a second walk). */
export function ledgerCoversFireSlot(startedAt: Date, fireAt: Date): boolean {
  return startedAt.getTime() >= fireAt.getTime();
}

export function formatScheduledFireAt(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatCountdownUntil(fireAt: Date, now: Date = new Date()): string {
  const ms = Math.max(0, fireAt.getTime() - now.getTime());
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.ceil(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export const CIN7_SCHEDULE_ACTIVE_POLL_MS = 4_000;
export const CIN7_SCHEDULE_IDLE_POLL_MAX_MS = 60_000;

/** How long the integrations page should wait before asking the status API again. */
export function cin7ScheduleStatusPollDelayMs(input: {
  running: boolean;
  nextFireAt: Date | null;
  now?: Date;
}): number {
  if (input.running) return CIN7_SCHEDULE_ACTIVE_POLL_MS;
  if (!input.nextFireAt) return CIN7_SCHEDULE_IDLE_POLL_MAX_MS;
  const ms = input.nextFireAt.getTime() - (input.now ?? new Date()).getTime();
  if (ms <= 8_000) return CIN7_SCHEDULE_ACTIVE_POLL_MS;
  return Math.min(
    Math.max(ms - 5_000, CIN7_SCHEDULE_ACTIVE_POLL_MS),
    CIN7_SCHEDULE_IDLE_POLL_MAX_MS
  );
}

/** Changes when an entity finishes or the walk starts/stops — not on every record tick. */
export function cin7EntityCompletionFingerprint(input: {
  running: boolean;
  currentEntity: string | null;
  lastRunId: string | null;
  lastRunStatus: string | null;
  entityStatuses: Array<{ entity: string; status: string }>;
}): string {
  const entities = input.entityStatuses
    .map((row) => `${row.entity}:${row.status}`)
    .sort()
    .join('|');
  return `${input.running ? '1' : '0'};${input.currentEntity ?? ''};${input.lastRunId ?? ''};${input.lastRunStatus ?? ''};${entities}`;
}
