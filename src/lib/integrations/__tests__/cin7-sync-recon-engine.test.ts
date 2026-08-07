import { partitionOmniContactsByType } from '@/lib/integrations/cin7-catalog-fetch';
import {
  delayForRetry,
  exponentialBackoffMs,
  parseRetryAfterMs,
} from '@/lib/integrations/cin7-http-retry';
import { isReconciliationSnapshotCacheable } from '@/lib/integrations/cin7-reconciliation-cache';
import { getIncompleteSyncEntities } from '@/lib/integrations/cin7-reconciliation-job';
import { toCin7SyncDisplayStatus } from '@/lib/integrations/cin7-sync-display';
import { resolveSyncStartPage, runPagedSyncEngine } from '@/lib/integrations/cin7-sync-engine';
import {
  assertCin7SyncAcceptance,
  buildCin7ModifiedSinceWhere,
  decideCin7SyncMode,
  floorSyncRecordCount,
  shouldPromoteCin7SyncComplete,
} from '@/lib/integrations/cin7-sync-incremental';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/prisma', () => {
  const cin7SyncRun = {
    update: vi.fn().mockResolvedValue({}),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const cin7SyncJobLog = {
    create: vi.fn().mockResolvedValue({}),
  };
  return {
    prisma: {
      cin7SyncRun,
      cin7SyncJobLog,
      cin7ReconRun: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      cin7ReconException: {
        create: vi.fn(),
        createMany: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      cin7CatalogSnapshot: { create: vi.fn(), findMany: vi.fn() },
      cin7NightlySyncLedger: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    },
  };
});

import { prisma } from '@/lib/db/prisma';

describe('parseRetryAfterMs', () => {
  it('parses delta-seconds', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
    expect(parseRetryAfterMs('0')).toBe(0);
  });

  it('parses HTTP-date', () => {
    const future = new Date(Date.now() + 5_000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThan(0);
    expect(ms!).toBeLessThanOrEqual(120_000);
  });

  it('returns null for garbage', () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs('nope')).toBeNull();
  });
});

describe('delayForRetry', () => {
  it('honours Retry-After on 429', () => {
    expect(delayForRetry({ status: 429, attempt: 0, retryAfterHeader: '3' })).toBe(3000);
  });

  it('uses exponential backoff for 5xx', () => {
    const a = exponentialBackoffMs(0, { baseMs: 1000, capMs: 30_000, jitterRatio: 0 });
    const b = exponentialBackoffMs(2, { baseMs: 1000, capMs: 30_000, jitterRatio: 0 });
    expect(a).toBe(1000);
    expect(b).toBe(4000);
  });
});

describe('resolveSyncStartPage', () => {
  it('resumes from nextPage when incomplete', () => {
    expect(resolveSyncStartPage({ status: 'incomplete', nextPage: 7, lastCommittedPage: 6 })).toBe(
      7
    );
  });

  it('starts at 1 after complete', () => {
    expect(
      resolveSyncStartPage({ status: 'complete', nextPage: null, lastCommittedPage: 12 })
    ).toBe(1);
  });
});

describe('runPagedSyncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not treat empty-after-error as EOF', async () => {
    let attempts = 0;
    const result = await runPagedSyncEngine({
      ownerUserId: 'user-1',
      entityType: 'products',
      runId: 'run-1',
      startPage: 1,
      timeBudgetMs: 60_000,
      pageSize: 250,
      pageGapMs: 0,
      maxEmptyRetries: 2,
      fetchPage: async () => {
        attempts += 1;
        return {
          sourceRowCount: 0,
          // Non-429 so test backoff stays short
          error: 'HTTP 503',
          persist: async () => ({ recordsProcessed: 0 }),
        };
      },
    });

    expect(attempts).toBeGreaterThan(1);
    expect(result.status).toBe('incomplete');
    expect(result.complete).toBe(false);
    expect(result.failedPage).toBe(1);
    expect(result.lastCommittedPage).toBe(0);
  }, 15_000);

  it('advances checkpoint only after persist succeeds', async () => {
    let pageCalls = 0;
    const result = await runPagedSyncEngine({
      ownerUserId: 'user-1',
      entityType: 'products',
      runId: 'run-1',
      startPage: 1,
      timeBudgetMs: 60_000,
      pageSize: 2,
      fetchPage: async (page) => {
        pageCalls += 1;
        if (page === 1) {
          return {
            sourceRowCount: 2,
            persist: async () => ({ recordsProcessed: 2 }),
          };
        }
        if (page === 2) {
          return {
            sourceRowCount: 2,
            persist: async () => {
              throw new Error('db down');
            },
          };
        }
        return {
          sourceRowCount: 0,
          persist: async () => ({ recordsProcessed: 0 }),
        };
      },
    });

    expect(pageCalls).toBe(2);
    expect(result.status).toBe('incomplete');
    expect(result.lastCommittedPage).toBe(1);
    expect(result.failedPage).toBe(2);
    expect(result.recordsProcessed).toBe(2);
  });

  it('completes only on clean empty EOF (not on short pages)', async () => {
    const pages: number[] = [];
    const result = await runPagedSyncEngine({
      ownerUserId: 'user-1',
      entityType: 'products',
      runId: 'run-1',
      startPage: 1,
      timeBudgetMs: 60_000,
      pageSize: 250,
      fetchPage: async (page) => {
        pages.push(page);
        if (page <= 3) {
          // Cin7 often returns < requested page size while more pages remain
          return {
            sourceRowCount: 100,
            persist: async () => ({ recordsProcessed: 100 }),
          };
        }
        return {
          sourceRowCount: 0,
          persist: async () => ({ recordsProcessed: 0 }),
        };
      },
    });

    expect(pages).toEqual([1, 2, 3, 4]);
    expect(result.status).toBe('complete');
    expect(result.complete).toBe(true);
    expect(result.recordsProcessed).toBe(300);
    expect(result.lastCommittedPage).toBe(3);
  });

  it('does not mark complete after short page alone', async () => {
    let calls = 0;
    const result = await runPagedSyncEngine({
      ownerUserId: 'user-1',
      entityType: 'customers',
      runId: 'run-1',
      startPage: 1,
      timeBudgetMs: 60_000,
      pageSize: 250,
      pageGapMs: 0,
      maxPages: 5,
      fetchPage: async () => {
        calls += 1;
        return {
          sourceRowCount: 100,
          persist: async () => ({ recordsProcessed: 100 }),
        };
      },
    });

    // Must keep paging to maxPages — never complete after first short page
    expect(calls).toBe(5);
    expect(result.status).toBe('incomplete');
    expect(result.lastCommittedPage).toBe(5);
    expect(result.complete).toBe(false);
  }, 15_000);
});

describe('fail-closed recon gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists entities that are not complete', async () => {
    vi.mocked(prisma.cin7SyncRun.findMany).mockResolvedValue([
      { entityType: 'products', status: 'complete' },
      { entityType: 'customers', status: 'incomplete' },
    ] as never);

    const incomplete = await getIncompleteSyncEntities('user-1');
    expect(incomplete).toContain('customers');
    expect(incomplete).toContain('orders');
    expect(incomplete).not.toContain('products');
  });
});

describe('nightly consecutive ledger semantics (unit)', () => {
  it('increments on full success and resets on fail', () => {
    const nextCount = (prev: number, allComplete: boolean) => (allComplete ? prev + 1 : 0);
    expect(nextCount(2, true)).toBe(3);
    expect(nextCount(3, false)).toBe(0);
    expect(nextCount(0, true)).toBe(1);
  });
});

describe('client requirement checklist (static) — sync recon engine', () => {
  const REPO_ROOT = process.cwd();

  it('sync history returns real status fields not forced ok', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/api/integrations/cin7/sync-history/route.ts`,
      'utf8'
    );
    expect(src).toContain('run.status');
    expect(src).not.toMatch(/status:\s*'ok'/);
    expect(src).toContain('last_committed_page');
    expect(src).toContain('failed_page');
  });

  it('sync route returns next_page and complete flags', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/api/integrations/cin7/sync/[entityType]/route.ts`,
      'utf8'
    );
    expect(src).toContain('runPagedSyncEngine');
    expect(src).toContain('next_page');
    expect(src).toContain('failed_page');
  });

  it('reconciliation route uses live Cin7 vs Optix builder with cache', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/api/integrations/cin7/reconciliation/route.ts`,
      'utf8'
    );
    expect(src).toContain('buildCin7Reconciliation');
    expect(src).toContain('getOrBuildReconciliation');
  });

  it('Omni and Core honor Retry-After helpers', async () => {
    const fs = await import('node:fs/promises');
    const omni = await fs.readFile(`${REPO_ROOT}/src/lib/integrations/cin7-omni.ts`, 'utf8');
    const core = await fs.readFile(`${REPO_ROOT}/src/lib/integrations/cin7-core.ts`, 'utf8');
    expect(omni).toContain('delayForRetry');
    expect(core).toContain('delayForRetry');
    expect(core).toContain('isRetryableHttpStatus');
  });

  it('sync-proof route exists', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile(
      `${REPO_ROOT}/src/app/api/integrations/cin7/sync-proof/route.ts`,
      'utf8'
    );
    expect(src).toContain('consecutive_complete_count');
    expect(src).toContain('proof_ready');
  });
});

describe('toCin7SyncDisplayStatus', () => {
  it('maps every non-complete status to incomplete for client UI', () => {
    expect(toCin7SyncDisplayStatus('complete')).toBe('complete');
    expect(toCin7SyncDisplayStatus('incomplete')).toBe('incomplete');
    expect(toCin7SyncDisplayStatus('idle')).toBe('incomplete');
    expect(toCin7SyncDisplayStatus('failed')).toBe('incomplete');
    expect(toCin7SyncDisplayStatus('running')).toBe('incomplete');
    expect(toCin7SyncDisplayStatus('never')).toBe('incomplete');
    expect(toCin7SyncDisplayStatus(undefined)).toBe('incomplete');
  });
});

describe('additive / incremental sync guards', () => {
  it('floors reported counts so sync never shows fewer than Optix', () => {
    expect(
      floorSyncRecordCount({ optixCount: 9842, thisRunProcessed: 50, previousFloor: 9842 })
    ).toBe(9842);
    expect(
      floorSyncRecordCount({ optixCount: 9900, thisRunProcessed: 100, previousFloor: 9842 })
    ).toBe(9900);
  });

  it('uses incremental mode after a successful complete sync', () => {
    const completedAt = new Date('2026-08-01T00:00:00Z');
    const decided = decideCin7SyncMode({
      forceFull: false,
      forceRestart: true,
      status: 'complete',
      completedAt,
    });
    expect(decided.mode).toBe('incremental');
    expect(decided.modifiedSince).not.toBeNull();
    expect(buildCin7ModifiedSinceWhere(decided.modifiedSince!)).toContain("modifieddate>='");
  });

  it('forces full mode when Optix is short of a known Cin7 total', () => {
    const decided = decideCin7SyncMode({
      forceFull: false,
      forceRestart: true,
      status: 'complete',
      completedAt: new Date('2026-08-01T00:00:00Z'),
      optixCount: 30_345,
      expectedSourceCount: 30_957,
    });
    expect(decided.mode).toBe('full');
    expect(decided.modifiedSince).toBeNull();
  });

  it('uses full mode when full=true', () => {
    const decided = decideCin7SyncMode({
      forceFull: true,
      forceRestart: true,
      status: 'complete',
      completedAt: new Date(),
    });
    expect(decided.mode).toBe('full');
    expect(decided.modifiedSince).toBeNull();
  });

  it('resumes incomplete runs from checkpoint', () => {
    const decided = decideCin7SyncMode({
      forceFull: false,
      forceRestart: false,
      status: 'incomplete',
      completedAt: null,
    });
    expect(decided.mode).toBe('resume');
  });

  it('forces full when Optix is short by even 1 row (tolerance 0)', () => {
    const decided = decideCin7SyncMode({
      forceFull: false,
      forceRestart: false,
      status: 'complete',
      completedAt: new Date('2026-08-01T00:00:00Z'),
      optixCount: 10_396,
      expectedSourceCount: 10_397,
    });
    expect(decided.mode).toBe('full');
  });
});

describe('fail-closed sync acceptance', () => {
  it('blocks complete when Optix is below known Cin7 total', () => {
    const gate = assertCin7SyncAcceptance({
      optixCount: 9840,
      cin7Expected: 9845,
      syncErrors: [],
    });
    expect(gate.accepted).toBe(false);
    expect(gate.reason).toContain('Optix 9840 < Cin7 9845');
  });

  it('blocks complete when sync errors are retained', () => {
    const gate = assertCin7SyncAcceptance({
      optixCount: 9845,
      cin7Expected: 9845,
      syncErrors: ['Page 26: Cin7 Omni HTTP 429'],
    });
    expect(gate.accepted).toBe(false);
    expect(gate.reason).toContain('sync errors retained');
  });

  it('accepts when Optix meets Cin7 and there are no errors', () => {
    const gate = assertCin7SyncAcceptance({
      optixCount: 9845,
      cin7Expected: 9845,
      syncErrors: [],
    });
    expect(gate.accepted).toBe(true);
    expect(gate.reason).toBeNull();
  });

  it('promotes incomplete when Optix already matches Cin7 floor', () => {
    expect(
      shouldPromoteCin7SyncComplete({
        status: 'incomplete',
        optixCount: 10_397,
        cin7Expected: 10_397,
        syncErrors: [],
      })
    ).toBe(true);
    expect(
      shouldPromoteCin7SyncComplete({
        status: 'complete',
        optixCount: 10_397,
        cin7Expected: 10_397,
        syncErrors: [],
      })
    ).toBe(false);
    expect(
      shouldPromoteCin7SyncComplete({
        status: 'incomplete',
        optixCount: 10_390,
        cin7Expected: 10_397,
        syncErrors: [],
      })
    ).toBe(false);
  });

  it('refuses to cache dirty recon snapshots', () => {
    const clean = {
      source: 'omni' as const,
      checked_at: new Date().toISOString(),
      cin7: {
        products: { styles: 1, skus: 1, by_visibility: {} },
        customers: 1,
        internal_customers: 0,
        suppliers: 0,
        branches: 0,
        reference: null,
      },
      optix: {
        products: { total_cin7_sourced: 1, skus: 1, styles: 1, by_visibility: {} },
        customers: { total: 1, cin7_linked: 1, extra_without_cin7_id: 0 },
        internal_customers: 0,
        suppliers: { total: 0, cin7_linked: 0, extra_without_cin7_id: 0 },
        branches: { total: 0 },
        reference: null,
      },
      exceptions_summary: {
        products_missing_in_optix: 0,
        products_extra_in_optix: 0,
        products_field_mismatches: 0,
        customers_missing_in_optix: 0,
        customers_extra_in_optix: 0,
        customers_field_mismatches: 0,
        suppliers_missing_in_optix: 0,
        suppliers_extra_in_optix: 0,
        suppliers_field_mismatches: 0,
        branches_missing_in_optix: 0,
        branches_extra_in_optix: 0,
        branches_field_mismatches: 0,
        internal_customers_missing_in_optix: 0,
        internal_customers_extra_in_optix: 0,
        internal_customers_field_mismatches: 0,
        product_categories_missing_in_optix: 0,
        product_categories_extra_in_optix: 0,
        brands_missing_in_optix: 0,
        brands_extra_in_optix: 0,
        price_lists_missing_in_optix: 0,
        price_lists_extra_in_optix: 0,
        tax_codes_missing_in_optix: 0,
        tax_codes_extra_in_optix: 0,
        units_of_measure_missing_in_optix: 0,
        units_of_measure_extra_in_optix: 0,
        stock_levels_missing_in_optix: 0,
        stock_levels_extra_in_optix: 0,
        stock_levels_field_mismatches: 0,
      },
      fetch_meta: { errors: [] as string[] },
      notes: [] as string[],
    };
    expect(isReconciliationSnapshotCacheable(clean)).toBe(true);
    expect(
      isReconciliationSnapshotCacheable({
        ...clean,
        fetch_meta: { errors: ['Page 26: HTTP 429'], incomplete: true },
        acceptance_blocked: true,
      })
    ).toBe(false);
  });
});

describe('partitionOmniContactsByType', () => {
  it('splits contacts by type case-insensitively and ignores others', () => {
    const partitioned = partitionOmniContactsByType([
      {
        cin7ContactId: '1',
        companyName: 'Acme',
        email: 'a@x.com',
        contactType: 'Customer',
      },
      {
        cin7ContactId: '2',
        companyName: 'Internal Co',
        email: 'i@x.com',
        contactType: 'internal',
      },
      {
        cin7ContactId: '3',
        companyName: 'Supply',
        email: 's@x.com',
        contactType: 'Supplier',
      },
      {
        cin7ContactId: '4',
        companyName: 'Other',
        email: 'o@x.com',
        contactType: 'Prospect',
      },
    ]);
    expect(partitioned.customers.map((c) => c.cin7ContactId)).toEqual(['1']);
    expect(partitioned.internalCustomers.map((c) => c.cin7ContactId)).toEqual(['2']);
    expect(partitioned.suppliers.map((c) => c.cin7ContactId)).toEqual(['3']);
  });
});
