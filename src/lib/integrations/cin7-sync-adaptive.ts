/**
 * Adaptive Cin7 sync pacing + short incompleteness copy.
 * Small entities should not pay full page/entity gaps; large catalogs keep safe delays.
 */

/** Gap before fetching `nextPage`, scaled by remaining work / known Total. */
export function resolveAdaptivePageGapMs(input: {
  configuredGapMs: number;
  nextPage: number;
  pageSize: number;
  reportedTotal: number | null;
  sourceRowsFetchedSoFar: number;
}): number {
  const configured = Math.max(0, Math.floor(input.configuredGapMs));
  if (configured === 0 || input.nextPage <= 1) return 0;

  const pageSize = Math.max(1, input.pageSize);
  const total = input.reportedTotal;

  if (typeof total === 'number' && total > 0) {
    const remaining = Math.max(0, total - Math.max(0, input.sourceRowsFetchedSoFar));
    if (remaining <= 0) return 0;
    const remainingPages = Math.ceil(remaining / pageSize);
    if (remainingPages <= 1) return 0;
    if (remainingPages <= 3) return Math.min(configured, 50);
    if (remainingPages <= 8) {
      return Math.min(configured, Math.max(100, Math.floor(configured / 2)));
    }
    return configured;
  }

  // Bare array (no Total): keep early pages fast; ramp up after we prove size.
  if (input.nextPage <= 2) return Math.min(configured, 50);
  if (input.nextPage <= 4) {
    return Math.min(configured, Math.max(100, Math.floor(configured / 2)));
  }
  return configured;
}

/** Gap between catalog entities — skip/shrink after a tiny previous pull. */
export function resolveAdaptiveEntityGapMs(input: {
  configuredGapMs: number;
  previousEntitySourceRows: number | null | undefined;
  pageSize: number;
}): number {
  const configured = Math.max(0, Math.floor(input.configuredGapMs));
  if (configured === 0) return 0;

  const rows = input.previousEntitySourceRows;
  if (rows == null || !Number.isFinite(rows)) return configured;

  const pageSize = Math.max(1, input.pageSize);
  if (rows <= pageSize) return 0;
  if (rows <= pageSize * 3) return Math.min(configured, 200);
  return configured;
}

/** Short user-facing line when synced count is below Cin7 (or run paused). */
export function buildShortSyncIncompleteMessage(input: {
  synced: number;
  expected: number | null | undefined;
  reason?: string | null;
}): string {
  const synced = Math.max(0, Math.floor(input.synced));
  const expected =
    typeof input.expected === 'number' && Number.isFinite(input.expected) && input.expected > 0
      ? Math.floor(input.expected)
      : null;

  if (expected != null && synced < expected) {
    return `Short of Cin7 (${synced.toLocaleString()} of ~${expected.toLocaleString()}). Click Continue to finish.`;
  }

  const reason = (input.reason ?? '').trim();
  if (/time budget|time limit/i.test(reason)) {
    return `Paused (time limit) at ${synced.toLocaleString()}. Click Continue to finish.`;
  }
  if (/429|rate-?limit/i.test(reason)) {
    return `Paused (Cin7 rate limit) at ${synced.toLocaleString()}. Click Continue to finish.`;
  }
  if (reason) {
    return reason.length > 120 ? `${reason.slice(0, 117)}…` : reason;
  }
  return `Incomplete at ${synced.toLocaleString()} records. Click Continue to finish.`;
}

/** Prefer the higher of recon cache vs live API Total when both are known. */
export function resolveCin7ExpectedCount(
  reconExpected: number | null | undefined,
  liveTotal: number | null | undefined
): number | null {
  const a =
    typeof reconExpected === 'number' && Number.isFinite(reconExpected) && reconExpected > 0
      ? Math.floor(reconExpected)
      : null;
  const b =
    typeof liveTotal === 'number' && Number.isFinite(liveTotal) && liveTotal > 0
      ? Math.floor(liveTotal)
      : null;
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}
