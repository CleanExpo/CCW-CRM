/**
 * Browser-side Cin7 sync schedule helpers.
 * Driven only by NEXT_PUBLIC_CIN7_SCHEDULED_SYNC_AT — no server cron / vercel.json.
 *
 * Formats:
 * - ISO datetime (e.g. 2026-08-02T02:33:00Z) → fire once at that instant
 * - HH:mm or HH:mm:ss → daily at that clock time in Australia/Sydney
 */

export const CIN7_SCHEDULED_SYNC_ENV = 'NEXT_PUBLIC_CIN7_SCHEDULED_SYNC_AT';

export const CIN7_CLIENT_SYNC_ENTITY_ORDER = [
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

export type Cin7ClientSyncEntity = (typeof CIN7_CLIENT_SYNC_ENTITY_ORDER)[number];

export type Cin7ScheduleSpec =
  | { kind: 'once'; at: Date; raw: string }
  | { kind: 'daily'; hour: number; minute: number; second: number; timeZone: string; raw: string };

const SYDNEY_TZ = 'Australia/Sydney';

/** Read schedule from the public env var (available in the browser). */
export function getCin7ScheduledSyncEnv(): string {
  return (process.env.NEXT_PUBLIC_CIN7_SCHEDULED_SYNC_AT ?? '').trim();
}

export function parseCin7ScheduledSyncAt(raw: string): Cin7ScheduleSpec | null {
  const value = raw.trim();
  if (!value) return null;

  // Daily local time: HH:mm or HH:mm:ss (Australia/Sydney)
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
    return { kind: 'daily', hour, minute, second, timeZone: SYDNEY_TZ, raw: value };
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
  // Start guess: treat as UTC then correct using the zone offset at that instant.
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i += 1) {
    const p = zonedParts(new Date(guess), SYDNEY_TZ);
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
    // Missed by more than 2 minutes → do not run (avoids surprise catch-up hours later).
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
  // Already passed today's slot (with 2 min grace) → schedule tomorrow.
  if (candidate.getTime() < from.getTime() - 2 * 60 * 1000) {
    const tomorrow = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const t = zonedParts(tomorrow, spec.timeZone);
    candidate = sydneyWallTimeToUtc(t.year, t.month, t.day, spec.hour, spec.minute, spec.second);
  }
  return candidate;
}

export function scheduledRunStorageKey(spec: Cin7ScheduleSpec, fireAt: Date): string {
  if (spec.kind === 'once') {
    return `cin7-client-sync:once:${spec.raw}`;
  }
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: spec.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fireAt);
  return `cin7-client-sync:daily:${spec.raw}:${day}`;
}

export function hasScheduledRunCompleted(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === 'done';
  } catch {
    return false;
  }
}

export function markScheduledRunCompleted(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, 'done');
  } catch {
    // ignore quota / private mode
  }
}

/** Human-readable local time for UI (never show raw ISO / env names). */
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
