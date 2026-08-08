import { describe, expect, it } from 'vitest';
import {
  delayForRetry,
  exponentialBackoffMs,
  isRetryableHttpStatus,
  parseRetryAfterMs,
  sleepForRetry,
} from '../cin7-http-retry';

const FIVE_MINUTES_MS = 300_000;

describe('parseRetryAfterMs', () => {
  it('returns null for a missing or blank header', () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs('   ')).toBeNull();
  });

  it('reads a delay expressed in seconds', () => {
    expect(parseRetryAfterMs('5')).toBe(5_000);
  });

  it('caps a seconds value at five minutes', () => {
    expect(parseRetryAfterMs('86400')).toBe(FIVE_MINUTES_MS);
  });

  it('reads an HTTP-date and returns the remaining delay', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const header = new Date(now + 30_000).toUTCString();
    expect(parseRetryAfterMs(header, now)).toBe(30_000);
  });

  it('caps an HTTP-date far in the future at five minutes', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const header = new Date(now + 3_600_000).toUTCString();
    expect(parseRetryAfterMs(header, now)).toBe(FIVE_MINUTES_MS);
  });

  it('returns 0 for an HTTP-date already in the past', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const header = new Date(now - 60_000).toUTCString();
    expect(parseRetryAfterMs(header, now)).toBe(0);
  });

  it('returns null for an uninterpretable header', () => {
    expect(parseRetryAfterMs('soon-ish')).toBeNull();
  });

  it('never returns a negative delay for a negative seconds value', () => {
    // '-5' fails the >= 0 seconds check and then parses as a past date, so the
    // date branch clamps it to 0. delayForRetry still applies its 1s floor.
    expect(parseRetryAfterMs('-5')).toBe(0);
    expect(delayForRetry({ status: 429, attempt: 0, retryAfterHeader: '-5' })).toBe(1_000);
  });
});

describe('exponentialBackoffMs', () => {
  it('doubles with each attempt when jitter is disabled', () => {
    const opts = { baseMs: 1_000, capMs: 60_000, jitterRatio: 0 };
    expect(exponentialBackoffMs(0, opts)).toBe(1_000);
    expect(exponentialBackoffMs(1, opts)).toBe(2_000);
    expect(exponentialBackoffMs(3, opts)).toBe(8_000);
  });

  it('never exceeds the cap', () => {
    const opts = { baseMs: 1_000, capMs: 5_000, jitterRatio: 0 };
    expect(exponentialBackoffMs(20, opts)).toBe(5_000);
  });

  it('treats a negative attempt as attempt zero', () => {
    const opts = { baseMs: 1_000, capMs: 60_000, jitterRatio: 0 };
    expect(exponentialBackoffMs(-3, opts)).toBe(1_000);
  });

  it('keeps jittered delays within the expected band and under the cap', () => {
    for (let i = 0; i < 50; i++) {
      const delay = exponentialBackoffMs(2, { baseMs: 1_000, capMs: 60_000, jitterRatio: 0.25 });
      expect(delay).toBeGreaterThanOrEqual(4_000);
      expect(delay).toBeLessThanOrEqual(5_000);
    }
  });
});

describe('delayForRetry', () => {
  it('honours Retry-After on a 429', () => {
    expect(delayForRetry({ status: 429, attempt: 0, retryAfterHeader: '12' })).toBe(12_000);
  });

  it('enforces a one-second floor on a very small Retry-After', () => {
    expect(delayForRetry({ status: 429, attempt: 0, retryAfterHeader: '0' })).toBe(1_000);
  });

  it('falls back to backoff on a 429 with no usable header', () => {
    const delay = delayForRetry({ status: 429, attempt: 0, retryAfterHeader: null });
    expect(delay).toBeGreaterThanOrEqual(5_000);
    expect(delay).toBeLessThanOrEqual(180_000);
  });

  it('uses the shorter server-error backoff for a 5xx', () => {
    const delay = delayForRetry({ status: 503, attempt: 0, retryAfterHeader: null });
    expect(delay).toBeGreaterThanOrEqual(1_000);
    expect(delay).toBeLessThanOrEqual(30_000);
  });
});

describe('sleepForRetry', () => {
  it('resolves immediately for a non-positive delay', async () => {
    await expect(sleepForRetry(0)).resolves.toBeUndefined();
  });

  it('resolves after waiting for a positive delay', async () => {
    const started = Date.now();
    await sleepForRetry(15);
    expect(Date.now() - started).toBeGreaterThanOrEqual(10);
  });
});

describe('isRetryableHttpStatus', () => {
  it('retries rate limits and server errors', () => {
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);
  });

  it('does not retry client errors or success', () => {
    expect(isRetryableHttpStatus(200)).toBe(false);
    expect(isRetryableHttpStatus(404)).toBe(false);
    expect(isRetryableHttpStatus(422)).toBe(false);
  });
});
