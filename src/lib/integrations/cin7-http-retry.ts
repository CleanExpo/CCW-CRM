/**
 * Shared Retry-After + exponential backoff helpers for Cin7 Omni/Core HTTP clients.
 */

export type Cin7HttpRetryResult<T> = {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
  retryAfterMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse Retry-After header (seconds or HTTP-date). Returns delay in ms, or null. */
export function parseRetryAfterMs(header: string | null, nowMs = Date.now()): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;

  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    // Cap at 5 minutes — Cin7 429 windows are often longer than 2 minutes.
    return Math.min(300_000, Math.floor(asSeconds * 1000));
  }

  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - nowMs;
    if (delta <= 0) return 0;
    return Math.min(300_000, delta);
  }

  return null;
}

export function exponentialBackoffMs(
  attempt: number,
  options?: { baseMs?: number; capMs?: number; jitterRatio?: number }
): number {
  const baseMs = options?.baseMs ?? 1_000;
  const capMs = options?.capMs ?? 60_000;
  const jitterRatio = options?.jitterRatio ?? 0.25;
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
  const jitter = exp * jitterRatio * Math.random();
  return Math.floor(Math.min(capMs, exp + jitter));
}

export function delayForRetry(input: {
  status: number;
  attempt: number;
  retryAfterHeader: string | null;
}): number {
  if (input.status === 429) {
    const fromHeader = parseRetryAfterMs(input.retryAfterHeader);
    if (fromHeader != null) return Math.max(fromHeader, 1_000);
    return exponentialBackoffMs(input.attempt, { baseMs: 5_000, capMs: 180_000 });
  }
  // 5xx / network-style retries
  return exponentialBackoffMs(input.attempt, { baseMs: 1_000, capMs: 30_000 });
}

export async function sleepForRetry(ms: number): Promise<void> {
  if (ms > 0) await sleep(ms);
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
