import { getCatalogPageGapMs } from '@/lib/integrations/cin7-catalog-fetch';
import { resolveAdaptivePageGapMs } from '@/lib/integrations/cin7-sync-adaptive';
import {
  CIN7_SYNC_SAFETY_MAX_PAGES,
  getCin7PageSize,
  getCin7SyncMaxPages,
} from '@/lib/integrations/cin7-sync-config';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Leave headroom before serverless maxDuration (default 300s). */
export function getCin7SyncTimeBudgetMs(): number {
  const n = Number(process.env.CIN7_SYNC_TIME_BUDGET_MS || 280_000);
  if (!Number.isFinite(n) || n < 30_000) return 280_000;
  return Math.min(600_000, Math.floor(n));
}

export type Cin7PagedSyncResult = {
  recordsProcessed: number;
  pagesFetched: number;
  errors: string[];
  complete: boolean;
  timedOut: boolean;
  nextPage: number | null;
};

export type Cin7PagedSyncPageMeta = {
  skippedInactive?: number;
  skippedMissingId?: number;
  skippedWrongType?: number;
  sourceRowCount?: number;
};

/**
 * Resilient Cin7 Omni pagination for sync — matches reconciliation behaviour:
 * page gaps, empty-page retries, per-page persist (no full-catalog memory), time budget.
 */
export async function runPagedOmniSync<T>(input: {
  startPage?: number;
  maxPages?: number;
  timeBudgetMs?: number;
  fetchPage: (page: number) => Promise<{
    items: T[];
    sourceRowCount: number;
    meta?: Cin7PagedSyncPageMeta;
    error?: string;
  }>;
  persistPage: (items: T[], page: number, meta?: Cin7PagedSyncPageMeta) => Promise<number>;
  onPageMeta?: (meta: Cin7PagedSyncPageMeta) => void;
}): Promise<Cin7PagedSyncResult> {
  const pageSize = getCin7PageSize();
  const maxPages = input.maxPages ?? getCin7SyncMaxPages() ?? CIN7_SYNC_SAFETY_MAX_PAGES;
  const pageGapMs = getCatalogPageGapMs();
  const timeBudgetMs = input.timeBudgetMs ?? getCin7SyncTimeBudgetMs();
  const startedAt = Date.now();

  let recordsProcessed = 0;
  let pagesFetched = 0;
  const errors: string[] = [];
  let emptyRetries = 0;
  const maxEmptyRetries = 4;
  let complete = false;
  let timedOut = false;
  let nextPage: number | null = null;
  let sourceRowsFetched = 0;
  /** Last empty page was after a fetch error — do not treat as end-of-catalog. */
  let emptyAfterFetchError = false;

  const startPage = Math.max(input.startPage ?? 1, 1);

  for (let page = startPage; page <= maxPages; page += 1) {
    if (Date.now() - startedAt > timeBudgetMs) {
      timedOut = true;
      nextPage = page;
      errors.push(
        `Stopped at page ${page}: sync time budget (${timeBudgetMs}ms) reached — resume with start_page=${page}`
      );
      break;
    }

    const adaptiveGap = resolveAdaptivePageGapMs({
      configuredGapMs: pageGapMs,
      nextPage: page,
      pageSize,
      reportedTotal: null,
      sourceRowsFetchedSoFar: sourceRowsFetched,
    });
    if (adaptiveGap > 0) {
      await sleep(adaptiveGap);
    }

    const result = await input.fetchPage(page);
    pagesFetched = page;

    if (result.error) {
      errors.push(`Page ${page}: ${result.error}`);
      emptyAfterFetchError = true;
    } else {
      emptyAfterFetchError = false;
    }

    if (result.sourceRowCount === 0) {
      if (emptyRetries < maxEmptyRetries) {
        emptyRetries += 1;
        errors.push(`Page ${page}: empty response — retry ${emptyRetries}/${maxEmptyRetries}`);
        await sleep(pageGapMs * (emptyRetries + 2));
        page -= 1;
        continue;
      }
      // API outage / rate-limit returns empty pages — never treat that as EOF.
      if (emptyAfterFetchError) {
        nextPage = page;
        errors.push(
          `Stopped at page ${page}: empty responses after fetch errors — resume with start_page=${page}`
        );
        break;
      }
      complete = true;
      break;
    }

    emptyRetries = 0;
    emptyAfterFetchError = false;
    sourceRowsFetched += result.sourceRowCount;
    if (result.meta && input.onPageMeta) {
      input.onPageMeta(result.meta);
    }

    recordsProcessed += await input.persistPage(result.items, page, result.meta);

    if (result.sourceRowCount < pageSize) {
      complete = true;
      break;
    }
  }

  if (!complete && !timedOut && pagesFetched >= maxPages) {
    errors.push(`Stopped: reached max pages cap (${maxPages})`);
    nextPage = pagesFetched + 1;
  } else if (complete) {
    nextPage = null;
  }

  return {
    recordsProcessed,
    pagesFetched,
    errors,
    complete,
    timedOut,
    nextPage,
  };
}
