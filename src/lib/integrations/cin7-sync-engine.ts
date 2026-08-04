/**
 * Checkpointed, resumable Cin7 paged sync engine.
 * Advances lastCommittedPage only after a successful persist for that page.
 */

import { prisma } from '@/lib/db/prisma';
import { getCin7SyncMaxPages } from '@/lib/integrations/cin7-sync-config';

export type Cin7SyncRunStatus = 'idle' | 'running' | 'complete' | 'incomplete' | 'failed';

/** Client-facing Recent sync labels — only these two. */
export type Cin7SyncDisplayStatus = 'complete' | 'incomplete';

/**
 * Map any stored sync status to a professional display status.
 * complete → complete; everything else (idle, running, failed, never, …) → incomplete.
 */
export function toCin7SyncDisplayStatus(status: string | null | undefined): Cin7SyncDisplayStatus {
  return status === 'complete' ? 'complete' : 'incomplete';
}

export type PagedSyncPageResult = {
  /** Raw rows returned by Cin7 for this page (0 = empty). */
  sourceRowCount: number;
  /** Authoritative Cin7 Total when the API envelope provides it. */
  total?: number | null;
  /** HTTP / fetch error message when the page could not be trusted. */
  error?: string;
  /** Persist this page into Optix. Must throw or return on failure. */
  persist: () => Promise<{
    recordsProcessed: number;
    /** Optional jump for multi-feed entities (e.g. tax contacts → branches). */
    nextPageOverride?: number;
    lastCommittedPageOverride?: number;
  }>;
};

export type RunPagedSyncEngineInput = {
  ownerUserId: string;
  /** Stored entity key (may be alias like warehouses). */
  entityType: string;
  runId: string;
  startPage: number;
  /** Wall-clock budget for this chunk (ms). */
  timeBudgetMs: number;
  pageSize: number;
  pageGapMs?: number;
  maxPages?: number;
  /** Empty confirms without error before treating as EOF. Default 1. */
  emptyEofConfirms?: number;
  maxEmptyRetries?: number;
  fetchPage: (page: number) => Promise<PagedSyncPageResult>;
  /** Prior cumulative records from earlier chunks (resume). */
  priorRecordsProcessed?: number;
  /**
   * Optional live Optix count after each page. When set, Recent sync shows the
   * authoritative Optix size (never dips below previous Optix data).
   */
  refreshRecordCount?: () => Promise<number>;
  /** Minimum records_processed while running (additive sync floor). */
  recordFloor?: number;
};

export type RunPagedSyncEngineResult = {
  /** Persisted/client status — only complete or incomplete (errors stay incomplete + failedPage). */
  status: 'complete' | 'incomplete';
  recordsProcessed: number;
  pagesFetched: number;
  lastCommittedPage: number;
  nextPage: number | null;
  failedPage: number | null;
  failureReason: string | null;
  syncErrors: string[];
  complete: boolean;
  durationMs: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getCin7SyncTimeBudgetMs(kind: 'interactive' | 'cron' = 'interactive'): number {
  const envKey = kind === 'cron' ? 'CIN7_SYNC_CRON_TIME_BUDGET_MS' : 'CIN7_SYNC_TIME_BUDGET_MS';
  const fallback = kind === 'cron' ? 240_000 : 90_000;
  const n = Number(process.env[envKey] || fallback);
  if (!Number.isFinite(n) || n < 5_000) return fallback;
  return Math.floor(n);
}

export async function appendCin7SyncJobLog(input: {
  ownerUserId: string;
  entityType: string;
  runId?: string | null;
  level?: string;
  message: string;
  page?: number | null;
  httpStatus?: number | null;
}): Promise<void> {
  try {
    await prisma.cin7SyncJobLog.create({
      data: {
        ownerUserId: input.ownerUserId,
        entityType: input.entityType,
        runId: input.runId ?? undefined,
        level: input.level ?? 'info',
        message: input.message,
        page: input.page ?? undefined,
        httpStatus: input.httpStatus ?? undefined,
      },
    });
  } catch {
    // Logging must never break sync.
  }
}

export async function loadOrCreateCin7SyncRun(input: {
  ownerUserId: string;
  entityType: string;
}): Promise<{
  id: string;
  status: string;
  lastCommittedPage: number;
  nextPage: number | null;
  recordsProcessed: number;
  pagesFetched: number;
  attemptCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}> {
  const existing = await prisma.cin7SyncRun.findFirst({
    where: { ownerUserId: input.ownerUserId, entityType: input.entityType },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return {
      id: existing.id,
      status: existing.status,
      lastCommittedPage: existing.lastCommittedPage,
      nextPage: existing.nextPage,
      recordsProcessed: existing.recordsProcessed,
      pagesFetched: existing.pagesFetched,
      attemptCount: existing.attemptCount,
      startedAt: existing.startedAt,
      completedAt: existing.completedAt,
      updatedAt: existing.updatedAt,
    };
  }

  const created = await prisma.cin7SyncRun.create({
    data: {
      ownerUserId: input.ownerUserId,
      entityType: input.entityType,
      // Prefer incomplete over idle — clients only see complete / incomplete.
      status: 'incomplete',
      recordsProcessed: 0,
      durationMs: 0,
      lastCommittedPage: 0,
      pagesFetched: 0,
      attemptCount: 0,
    },
  });

  return {
    id: created.id,
    status: created.status,
    lastCommittedPage: created.lastCommittedPage,
    nextPage: created.nextPage,
    recordsProcessed: created.recordsProcessed,
    pagesFetched: created.pagesFetched,
    attemptCount: created.attemptCount,
    startedAt: created.startedAt,
    completedAt: created.completedAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * No checkpoint / heartbeat for this long → abandoned (client timeout / process kill).
 * Use updatedAt (not startedAt) so long live syncs that keep writing pages stay "running".
 * Must be longer than a single request time budget (~90s) with some slack.
 */
export const CIN7_SYNC_STALE_RUNNING_MS = 6 * 60 * 1000;

export function resolveSyncStartPage(run: {
  status: string;
  nextPage: number | null;
  lastCommittedPage: number;
}): number {
  if (run.status === 'incomplete' || run.status === 'running') {
    if (run.nextPage != null && run.nextPage > 0) return run.nextPage;
    if (run.lastCommittedPage > 0) return run.lastCommittedPage + 1;
  }
  // Fresh start for complete/failed/idle
  return 1;
}

/**
 * Normalize stored statuses so the UI never surfaces idle / stuck running / failed jargon.
 * - Abandoned running → incomplete (resumable)
 * - Legacy idle → incomplete
 * - failed → incomplete (keeps failed_page / failure_reason for resume)
 */
export async function recoverStaleCin7SyncRuns(
  ownerUserId: string,
  staleMs = CIN7_SYNC_STALE_RUNNING_MS
): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs);
  const staleRunning = await prisma.cin7SyncRun.updateMany({
    where: {
      ownerUserId,
      status: 'running',
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'incomplete',
      failureReason: 'Sync paused — click Sync again to continue.',
    },
  });
  const idle = await prisma.cin7SyncRun.updateMany({
    where: { ownerUserId, status: 'idle' },
    data: {
      status: 'incomplete',
      failureReason: null,
    },
  });
  const failed = await prisma.cin7SyncRun.updateMany({
    where: { ownerUserId, status: 'failed' },
    data: {
      status: 'incomplete',
    },
  });
  return staleRunning.count + idle.count + failed.count;
}

export function isCin7SyncRunStaleRunning(
  run: { status: string; startedAt?: Date | null; updatedAt?: Date },
  staleMs = CIN7_SYNC_STALE_RUNNING_MS
): boolean {
  if (run.status !== 'running') return false;
  const anchor = run.updatedAt ?? run.startedAt;
  if (!anchor) return true;
  return Date.now() - anchor.getTime() > staleMs;
}

export async function markCin7SyncRunRunning(input: {
  runId: string;
  resetCheckpoint: boolean;
  /** Never drop the displayed count below Optix / prior floor (additive sync). */
  recordFloor?: number;
}): Promise<void> {
  const floor = Math.max(0, input.recordFloor ?? 0);
  await prisma.cin7SyncRun.update({
    where: { id: input.runId },
    data: {
      status: 'running',
      startedAt: new Date(),
      completedAt: null,
      failureReason: null,
      failedPage: null,
      ...(input.resetCheckpoint
        ? {
            lastCommittedPage: 0,
            nextPage: 1,
            // Keep the floor so Recent sync never flashes a lower count mid-run.
            recordsProcessed: floor,
            pagesFetched: 0,
          }
        : {}),
      attemptCount: { increment: 1 },
    },
  });
}

export async function persistCin7SyncRunCheckpoint(input: {
  runId: string;
  status: Cin7SyncRunStatus;
  recordsProcessed: number;
  pagesFetched: number;
  lastCommittedPage: number;
  nextPage: number | null;
  failedPage: number | null;
  failureReason: string | null;
  durationMs: number;
  skipped?: Record<string, number>;
  source?: string;
}): Promise<void> {
  const completedAt = input.status === 'complete' ? new Date() : null;
  await prisma.cin7SyncRun.update({
    where: { id: input.runId },
    data: {
      status: input.status,
      recordsProcessed: input.recordsProcessed,
      pagesFetched: input.pagesFetched,
      lastCommittedPage: input.lastCommittedPage,
      nextPage: input.nextPage,
      failedPage: input.failedPage,
      failureReason: input.failureReason,
      durationMs: input.durationMs,
      skipped: input.skipped ?? undefined,
      source: input.source,
      completedAt,
      // Keep createdAt as "last meaningful update" for history UI when complete
      ...(input.status === 'complete' ? { createdAt: new Date() } : {}),
    },
  });
}

/**
 * Run pages until EOF, failure, or time budget. Checkpoint advances only after persist succeeds.
 */
export async function runPagedSyncEngine(
  input: RunPagedSyncEngineInput
): Promise<RunPagedSyncEngineResult> {
  const startedAt = Date.now();
  const maxPages = input.maxPages ?? getCin7SyncMaxPages();
  const pageGapMs = input.pageGapMs ?? 0;
  const maxEmptyRetries = input.maxEmptyRetries ?? 6;
  const emptyEofConfirms = input.emptyEofConfirms ?? 1;

  let page = Math.max(1, input.startPage);
  let lastCommittedPage = Math.max(0, page - 1);
  const recordFloor = Math.max(0, input.recordFloor ?? 0);
  let recordsProcessed = Math.max(recordFloor, input.priorRecordsProcessed ?? 0);
  let pagesFetched = 0;
  let emptyRetries = 0;
  let emptyEofHits = 0;
  let sourceRowsFetched = 0;
  let reportedTotal: number | null = null;
  const syncErrors: string[] = [];

  const budgetExceeded = () => Date.now() - startedAt >= input.timeBudgetMs;

  while (page <= maxPages) {
    if (budgetExceeded() && pagesFetched > 0) {
      await appendCin7SyncJobLog({
        ownerUserId: input.ownerUserId,
        entityType: input.entityType,
        runId: input.runId,
        level: 'warn',
        message: `Time budget reached before page ${page}; resumable.`,
        page,
      });
      const durationMs = Date.now() - startedAt;
      await persistCin7SyncRunCheckpoint({
        runId: input.runId,
        status: 'incomplete',
        recordsProcessed,
        pagesFetched: lastCommittedPage,
        lastCommittedPage,
        nextPage: page,
        failedPage: null,
        failureReason: 'Time budget exceeded; resume from next_page.',
        durationMs,
      });
      return {
        status: 'incomplete',
        recordsProcessed,
        pagesFetched: lastCommittedPage,
        lastCommittedPage,
        nextPage: page,
        failedPage: null,
        failureReason: 'Time budget exceeded; resume from next_page.',
        syncErrors,
        complete: false,
        durationMs,
      };
    }

    if (page > 1 && pageGapMs > 0) {
      await sleep(pageGapMs);
    }

    let fetched: PagedSyncPageResult;
    try {
      fetched = await input.fetchPage(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      syncErrors.push(`Page ${page}: ${message}`);
      const durationMs = Date.now() - startedAt;
      await persistCin7SyncRunCheckpoint({
        runId: input.runId,
        status: 'incomplete',
        recordsProcessed,
        pagesFetched: lastCommittedPage,
        lastCommittedPage,
        nextPage: page,
        failedPage: page,
        failureReason: message,
        durationMs,
      });
      await appendCin7SyncJobLog({
        ownerUserId: input.ownerUserId,
        entityType: input.entityType,
        runId: input.runId,
        level: 'error',
        message,
        page,
      });
      return {
        status: 'incomplete',
        recordsProcessed,
        pagesFetched: lastCommittedPage,
        lastCommittedPage,
        nextPage: page,
        failedPage: page,
        failureReason: message,
        syncErrors,
        complete: false,
        durationMs,
      };
    }

    pagesFetched = page;

    if (fetched.sourceRowCount === 0) {
      if (fetched.error) {
        syncErrors.push(`Page ${page}: ${fetched.error}`);
        if (emptyRetries < maxEmptyRetries) {
          emptyRetries += 1;
          syncErrors.push(
            `Page ${page}: empty after error — retry ${emptyRetries}/${maxEmptyRetries}`
          );
          await appendCin7SyncJobLog({
            ownerUserId: input.ownerUserId,
            entityType: input.entityType,
            runId: input.runId,
            level: 'warn',
            message: `Empty after error; retry ${emptyRetries}/${maxEmptyRetries}`,
            page,
          });
          const is429 = /429|rate-?limit/i.test(fetched.error ?? '');
          const backoff = is429
            ? Math.min(180_000, 5_000 * 2 ** (emptyRetries - 1))
            : Math.max(pageGapMs, 300) * (emptyRetries + 2);
          await sleep(backoff);
          continue;
        }
        const failureReason = `Empty page after errors at page ${page} (not marked complete; resume from next_page)`;
        const durationMs = Date.now() - startedAt;
        await persistCin7SyncRunCheckpoint({
          runId: input.runId,
          status: 'incomplete',
          recordsProcessed,
          pagesFetched: lastCommittedPage,
          lastCommittedPage,
          nextPage: page,
          failedPage: page,
          failureReason,
          durationMs,
        });
        return {
          status: 'incomplete',
          recordsProcessed,
          pagesFetched: lastCommittedPage,
          lastCommittedPage,
          nextPage: page,
          failedPage: page,
          failureReason,
          syncErrors,
          complete: false,
          durationMs,
        };
      }

      emptyEofHits += 1;
      if (emptyEofHits < emptyEofConfirms) {
        await sleep(Math.max(pageGapMs, 200));
        continue;
      }

      // Empty pages before Cin7's reported Total → false EOF; keep resumable.
      if (reportedTotal != null && reportedTotal > 0 && sourceRowsFetched + 5 < reportedTotal) {
        const failureReason = `Empty page at ${page} but only fetched ${sourceRowsFetched}/${reportedTotal} source rows — not complete.`;
        const durationMs = Date.now() - startedAt;
        await persistCin7SyncRunCheckpoint({
          runId: input.runId,
          status: 'incomplete',
          recordsProcessed,
          pagesFetched: lastCommittedPage,
          lastCommittedPage,
          nextPage: page,
          failedPage: null,
          failureReason,
          durationMs,
        });
        await appendCin7SyncJobLog({
          ownerUserId: input.ownerUserId,
          entityType: input.entityType,
          runId: input.runId,
          level: 'warn',
          message: failureReason,
          page,
        });
        return {
          status: 'incomplete',
          recordsProcessed,
          pagesFetched: lastCommittedPage,
          lastCommittedPage,
          nextPage: page,
          failedPage: null,
          failureReason,
          syncErrors,
          complete: false,
          durationMs,
        };
      }

      // Clean EOF
      const durationMs = Date.now() - startedAt;
      await persistCin7SyncRunCheckpoint({
        runId: input.runId,
        status: 'complete',
        recordsProcessed,
        pagesFetched: lastCommittedPage,
        lastCommittedPage,
        nextPage: null,
        failedPage: null,
        failureReason: null,
        durationMs,
      });
      await appendCin7SyncJobLog({
        ownerUserId: input.ownerUserId,
        entityType: input.entityType,
        runId: input.runId,
        level: 'info',
        message: `Sync complete at EOF page ${page} (${recordsProcessed} records).`,
        page,
      });
      return {
        status: 'complete',
        recordsProcessed,
        pagesFetched: lastCommittedPage,
        lastCommittedPage,
        nextPage: null,
        failedPage: null,
        failureReason: null,
        syncErrors,
        complete: true,
        durationMs,
      };
    }

    emptyRetries = 0;
    emptyEofHits = 0;
    sourceRowsFetched += fetched.sourceRowCount;
    if (typeof fetched.total === 'number' && fetched.total > 0) {
      reportedTotal = Math.max(reportedTotal ?? 0, fetched.total);
    }

    try {
      const persistResult = await fetched.persist();
      const pageRecords = persistResult.recordsProcessed;
      if (input.refreshRecordCount) {
        const live = await input.refreshRecordCount();
        recordsProcessed = Math.max(recordFloor, live, recordsProcessed);
      } else {
        recordsProcessed = Math.max(recordFloor, recordsProcessed + pageRecords);
      }
      lastCommittedPage = persistResult.lastCommittedPageOverride ?? page;
      const nextPageAfterCommit = persistResult.nextPageOverride ?? page + 1;
      await prisma.cin7SyncRun.update({
        where: { id: input.runId },
        data: {
          lastCommittedPage,
          nextPage: nextPageAfterCommit,
          recordsProcessed,
          pagesFetched: lastCommittedPage,
          status: 'running',
        },
      });
      await appendCin7SyncJobLog({
        ownerUserId: input.ownerUserId,
        entityType: input.entityType,
        runId: input.runId,
        level: 'info',
        message: `Committed page ${page} (+${pageRecords} upserts; count=${recordsProcessed}).`,
        page,
      });
      // Multi-feed jump (e.g. tax contacts → branches).
      if (persistResult.nextPageOverride != null) {
        page = persistResult.nextPageOverride;
        continue;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      syncErrors.push(`Page ${page} persist failed: ${message}`);
      const durationMs = Date.now() - startedAt;
      await persistCin7SyncRunCheckpoint({
        runId: input.runId,
        status: 'incomplete',
        recordsProcessed,
        pagesFetched: lastCommittedPage,
        lastCommittedPage,
        nextPage: page,
        failedPage: page,
        failureReason: message,
        durationMs,
      });
      return {
        status: 'incomplete',
        recordsProcessed,
        pagesFetched: lastCommittedPage,
        lastCommittedPage,
        nextPage: page,
        failedPage: page,
        failureReason: message,
        syncErrors,
        complete: false,
        durationMs,
      };
    }

    // Do NOT treat sourceRowCount < requested pageSize as EOF.
    // Cin7 Omni often returns fewer rows than requested (e.g. ask 250, get 100)
    // while more pages remain — that caused false "complete" at round page boundaries.
    // Clean EOF is only an empty page with no HTTP error (handled above).
    page += 1;
  }

  // Hit max pages safety ceiling — treat as incomplete unless last page was partial.
  // Without a "partial page" signal we mark incomplete so ops can raise the cap.
  const durationMs = Date.now() - startedAt;
  const failureReason = `Reached max pages (${maxPages}) without clean EOF.`;
  await persistCin7SyncRunCheckpoint({
    runId: input.runId,
    status: 'incomplete',
    recordsProcessed,
    pagesFetched: lastCommittedPage,
    lastCommittedPage,
    nextPage: page,
    failedPage: null,
    failureReason,
    durationMs,
  });
  return {
    status: 'incomplete',
    recordsProcessed,
    pagesFetched: lastCommittedPage,
    lastCommittedPage,
    nextPage: page,
    failedPage: null,
    failureReason,
    syncErrors,
    complete: false,
    durationMs,
  };
}
