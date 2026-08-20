import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import {
  fetchFullOmniContactsByType,
  fetchOmniTaxCodeCatalog,
  getCatalogPageGapMs,
  mapPriceColumnLabels,
  resolveCin7SyncSource,
} from '@/lib/integrations/cin7-catalog-fetch';
import {
  fetchCin7CustomerPage,
  fetchCin7ProductPage,
  fetchCin7SaleTotal,
  getCin7CoreCredentials,
  pingCin7Core,
} from '@/lib/integrations/cin7-core';
import { resolveCin7SyncEntityAlias } from '@/lib/integrations/cin7-master-entities';
import { runAuditedStockWalkDeletes } from '@/lib/integrations/cin7-heal-audit';
import {
  isCin7StockSyncEntity,
  mergeStockWalkKeys,
  readStockWalkCheckpoint,
  writeStockWalkCheckpoint,
  type StockWalkCheckpoint,
} from '@/lib/integrations/cin7-stock-walk-deletes';
import {
  extractReferenceDataFromProducts,
  fetchOmniBranchesPage,
  fetchOmniContactsPage,
  fetchOmniProductCategoriesPage,
  fetchOmniProductPage,
  fetchOmniProductsRawPage,
  fetchOmniSalesOrderCount,
  fetchOmniStockPage,
  getCin7OmniCredentials,
  pingCin7Omni,
} from '@/lib/integrations/cin7-omni';
import {
  clearCachedReconciliation,
  getCachedReconciliation,
} from '@/lib/integrations/cin7-reconciliation-cache';
import {
  buildShortSyncIncompleteMessage,
  resolveCin7ExpectedCount,
} from '@/lib/integrations/cin7-sync-adaptive';
import { getCin7PageSize, getCin7SyncMaxPages } from '@/lib/integrations/cin7-sync-config';
import {
  getCin7SyncTimeBudgetMs,
  heartbeatCin7SyncRun,
  isCin7SyncRunStaleRunning,
  loadOrCreateCin7SyncRun,
  persistCin7SyncRunCheckpoint,
  recoverStaleCin7SyncRuns,
  resolveSyncStartPage,
  runPagedSyncEngine,
  tryAcquireCin7SyncRunLock,
} from '@/lib/integrations/cin7-sync-engine';
import {
  assertCin7SyncAcceptance,
  buildCin7ModifiedSinceWhere,
  decideCin7SyncMode,
  entitySupportsModifiedSince,
  expectedCin7CountFromRecon,
  finalizeSyncRecordCount,
  floorSyncRecordCount,
  getOptixEntityRecordCount,
  shouldPromoteCin7SyncComplete,
} from '@/lib/integrations/cin7-sync-incremental';
import {
  batchUpsertBranches,
  batchUpsertBrands,
  batchUpsertCustomers,
  batchUpsertPriceLists,
  batchUpsertProductCategories,
  batchUpsertProducts,
  batchUpsertStockLevels,
  batchUpsertSuppliers,
  batchUpsertTaxCodes,
  batchUpsertUnitsOfMeasure,
  mapCoreCustomerRows,
  mapCoreProductRows,
  mapOmniBranchRows,
  mapOmniCustomerRows,
  mapOmniProductRows,
  mapOmniStockLevelRows,
  mapOmniSupplierRows,
  type Cin7SyncSkipInput,
} from '@/lib/integrations/cin7-sync-persist';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

type SyncSkipped = {
  wrong_contact_type: number;
  missing_cin7_id: number;
  inactive_products: number;
  missing_core_id: number;
  stock_deletes?: unknown;
};

function jsonSyncResult(input: {
  status: string;
  recordsProcessed: number;
  durationMs: number;
  pageSize: number;
  complete: boolean;
  nextPage: number | null;
  failedPage: number | null;
  syncErrors: string[];
  skipped: Record<string, unknown>;
  cin7SourceStyles?: number;
  lastCommittedPage?: number;
  cin7Count?: number | null;
  completenessMessage?: string | null;
}) {
  return NextResponse.json({
    status: input.status,
    records_processed: input.recordsProcessed,
    cin7_source_styles: input.cin7SourceStyles || undefined,
    skipped: input.skipped,
    duration_ms: input.durationMs,
    page_size: input.pageSize,
    complete: input.complete,
    next_page: input.nextPage,
    failed_page: input.failedPage,
    last_committed_page: input.lastCommittedPage,
    sync_errors: input.syncErrors.length > 0 ? input.syncErrors.slice(0, 20) : undefined,
    cin7_count: input.cin7Count ?? undefined,
    completeness_message: input.completenessMessage ?? undefined,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ entityType: string }> }
) {
  const scope = await requireAuthScopeOrCronIntegrationJob(request);
  if (!scope) {
    return NextResponse.json(
      {
        detail:
          'Not authenticated. For cron, send Authorization: Bearer CRON_SECRET and set CRON_INTEGRATION_USER_ID.',
      },
      { status: 401 }
    );
  }

  const { entityType: rawEntityType } = await context.params;
  const entityType = resolveCin7SyncEntityAlias(rawEntityType);
  const allowed = [
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
  if (!allowed.includes(rawEntityType as (typeof allowed)[number])) {
    return NextResponse.json({ detail: 'Unsupported entity type' }, { status: 400 });
  }

  const forceRestart = request.nextUrl.searchParams.get('restart') === 'true';
  // full=true forces a complete catalog walk; default re-sync after complete is incremental.
  const forceFull = request.nextUrl.searchParams.get('full') === 'true';
  const isCron = Boolean(request.headers.get('authorization')?.startsWith('Bearer '));
  const timeBudgetMs = getCin7SyncTimeBudgetMs(isCron ? 'cron' : 'interactive');

  const coreCreds = getCin7CoreCredentials(request);
  const omniCreds = getCin7OmniCredentials(request);

  const coreLive = coreCreds ? await pingCin7Core(coreCreds) : false;
  const omniLive = omniCreds ? await pingCin7Omni(omniCreds) : false;

  const sourceKind = resolveCin7SyncSource(coreLive, omniLive);
  const useCore = sourceKind === 'core';
  const useOmni = sourceKind === 'omni';

  if (!useCore && !useOmni) {
    return NextResponse.json(
      {
        detail:
          'Cin7 is not reachable. Configure Cin7 Core and/or Omni and ensure at least one API accepts your credentials.',
      },
      { status: 401 }
    );
  }

  const pageSize = getCin7PageSize();
  const maxPages = getCin7SyncMaxPages();
  const pageGapMs = getCatalogPageGapMs();
  const skipped: SyncSkipped = {
    wrong_contact_type: 0,
    missing_cin7_id: 0,
    inactive_products: 0,
    missing_core_id: 0,
  };
  const skipRecords: Cin7SyncSkipInput[] = [];
  let cin7SourceStyles = 0;

  await recoverStaleCin7SyncRuns(scope.userId);

  let run = await loadOrCreateCin7SyncRun({
    ownerUserId: scope.userId,
    entityType: rawEntityType,
  });

  // Stale running → incomplete so we can steal the lock below.
  if (run.status === 'running' && isCin7SyncRunStaleRunning(run)) {
    await persistCin7SyncRunCheckpoint({
      runId: run.id,
      status: 'incomplete',
      recordsProcessed: run.recordsProcessed,
      pagesFetched: run.pagesFetched,
      lastCommittedPage: run.lastCommittedPage,
      nextPage: run.nextPage ?? run.lastCommittedPage + 1,
      failedPage: null,
      failureReason: 'Sync abandoned (stale running) — resuming.',
      durationMs: 0,
    });
    run = { ...run, status: 'incomplete' };
  }

  const optixFloor = await getOptixEntityRecordCount(scope.userId, rawEntityType);
  const reconCached = getCachedReconciliation(scope.userId);
  const expectedSourceCount = expectedCin7CountFromRecon(entityType, reconCached?.snapshot ?? null);
  const { mode: syncMode, modifiedSince } = decideCin7SyncMode({
    forceFull,
    forceRestart,
    status: forceRestart ? 'incomplete' : run.status === 'running' ? 'incomplete' : run.status,
    completedAt: run.completedAt,
    optixCount: optixFloor,
    expectedSourceCount,
    entityType,
  });
  const incrementalWhere =
    syncMode === 'incremental' &&
    modifiedSince &&
    entitySupportsModifiedSince(entityType) &&
    useOmni
      ? buildCin7ModifiedSinceWhere(modifiedSince)
      : null;
  if (
    syncMode === 'full' &&
    typeof expectedSourceCount === 'number' &&
    optixFloor + 5 < expectedSourceCount
  ) {
    console.log(
      `[Cin7 sync] ${rawEntityType}: forcing full walk — Optix ${optixFloor} < Cin7 ${expectedSourceCount} (recon cache)`
    );
  }

  const resetCheckpoint =
    syncMode === 'full' ||
    syncMode === 'incremental' ||
    forceRestart ||
    run.status === 'complete' ||
    run.status === 'failed' ||
    run.status === 'idle';
  const startPage = syncMode === 'resume' ? resolveSyncStartPage(run) : 1;
  // Additive: never start the counter below Optix; resume keeps the higher of Optix/run.
  const priorRecords =
    syncMode === 'resume' ? Math.max(optixFloor, run.recordsProcessed) : optixFloor;

  const isStockEntity = isCin7StockSyncEntity(entityType);
  const stockWalkKind = incrementalWhere ? 'incremental' : 'full';
  let stockWalk: StockWalkCheckpoint | null = null;
  if (isStockEntity) {
    const stored = await prisma.cin7SyncRun.findFirst({
      where: { id: run.id },
      select: { skipped: true },
    });
    const prior = readStockWalkCheckpoint(stored?.skipped);
    const priorCount =
      prior?.kind === 'full' && prior.keys.length > 0
        ? prior.keys.length
        : (prior?.priorCompleteFullKeys ?? null);
    if (syncMode === 'resume' && !resetCheckpoint && prior) {
      stockWalk = {
        kind: prior.kind,
        keys: prior.keys,
        priorCompleteFullKeys: prior.priorCompleteFullKeys ?? priorCount,
      };
    } else {
      stockWalk = {
        kind: stockWalkKind,
        keys: [],
        priorCompleteFullKeys: priorCount,
      };
    }
  }

  // Atomic lock — avoids two tax-codes requests both passing a status check then racing.
  if (!forceRestart) {
    const lock = await tryAcquireCin7SyncRunLock({
      runId: run.id,
      resetCheckpoint,
      recordFloor: optixFloor,
    });
    if (!lock.acquired) {
      // 200 (not 409) so the client waits/retries instead of error-spamming the console.
      return NextResponse.json({
        status: 'running',
        detail:
          'Sync already in progress for this entity. Wait for it to finish — progress is saved.',
        complete: false,
        records_processed: run.recordsProcessed,
        next_page: run.nextPage,
        last_committed_page: run.lastCommittedPage,
      });
    }
  } else {
    await tryAcquireCin7SyncRunLock({
      runId: run.id,
      resetCheckpoint: true,
      recordFloor: optixFloor,
      allowStealStale: true,
      staleMs: 0,
    });
  }

  console.log(
    `[Cin7 sync] ${rawEntityType}: mode=${syncMode}` +
      `${incrementalWhere ? ` where=${incrementalWhere}` : ''} optix_floor=${optixFloor}`
  );

  // Tax codes: one-shot from contacts + branches (not paged). The old BRANCH_BASE
  // page bridge jumped early on short Cin7 pages and left status stuck incomplete.
  if (entityType === 'tax-codes') {
  const startedAt = Date.now();
    if (!useOmni || !omniCreds) {
      await persistCin7SyncRunCheckpoint({
        runId: run.id,
        status: 'incomplete',
        recordsProcessed: 0,
        pagesFetched: 0,
        lastCommittedPage: 0,
        nextPage: 1,
        failedPage: 1,
        failureReason: 'Tax code sync requires Cin7 Omni.',
        durationMs: 0,
        source: sourceKind,
      });
      return NextResponse.json({ detail: 'Tax code sync requires Cin7 Omni.' }, { status: 400 });
    }
    try {
      // Full unfiltered TaxStatus walk (same completeness as recon). Heartbeat keeps the lock.
      const expectedTaxCodes =
        typeof expectedSourceCount === 'number' && expectedSourceCount > 0
          ? expectedSourceCount
          : undefined;
      const catalog = await fetchOmniTaxCodeCatalog(omniCreds, {
        expectedMinCodes: expectedTaxCodes,
        onPage: async () => {
          await heartbeatCin7SyncRun(run.id);
        },
      });
      const pagesFetched = catalog.pages_fetched;
      const errors = catalog.errors;
      const taxCodes = catalog.taxCodes;
      const durationMs = Date.now() - startedAt;
      if (errors.length > 0 && taxCodes.length === 0) {
        const floored = floorSyncRecordCount({
          optixCount: optixFloor,
          thisRunProcessed: 0,
          previousFloor: optixFloor,
        });
        const shortMsg = buildShortSyncIncompleteMessage({
          synced: floored,
          expected: expectedTaxCodes ?? null,
          reason: errors.slice(0, 3).join('; '),
        });
        await persistCin7SyncRunCheckpoint({
          runId: run.id,
          status: 'incomplete',
          recordsProcessed: floored,
          pagesFetched,
          lastCommittedPage: 0,
          nextPage: 1,
          failedPage: 1,
          failureReason: shortMsg,
          durationMs,
          source: sourceKind,
        });
        return jsonSyncResult({
          status: 'incomplete',
          recordsProcessed: floored,
          durationMs,
          pageSize,
          complete: false,
          nextPage: 1,
          failedPage: 1,
          syncErrors: errors.slice(0, 20),
          skipped,
          cin7Count: expectedTaxCodes ?? null,
          completenessMessage: shortMsg,
        });
      }
      await batchUpsertTaxCodes(scope.userId, taxCodes);
      const optixAfter = await getOptixEntityRecordCount(scope.userId, rawEntityType);
      const recordsProcessed = floorSyncRecordCount({
        optixCount: optixAfter,
        thisRunProcessed: taxCodes.length,
        previousFloor: optixFloor,
      });
      const acceptance = assertCin7SyncAcceptance({
        optixCount: optixAfter,
        cin7Expected: expectedTaxCodes ?? null,
        syncErrors: errors,
      });
      const status = acceptance.accepted ? 'complete' : 'incomplete';
      if (!acceptance.accepted && acceptance.reason) {
        errors.push(acceptance.reason);
      }
      const shortMsg = acceptance.accepted
        ? null
        : buildShortSyncIncompleteMessage({
            synced: recordsProcessed,
            expected: expectedTaxCodes ?? null,
            reason: acceptance.reason ?? errors.slice(0, 3).join('; '),
          });
      await persistCin7SyncRunCheckpoint({
        runId: run.id,
        status,
        recordsProcessed,
        pagesFetched,
        lastCommittedPage: Math.max(1, pagesFetched),
        nextPage: acceptance.accepted ? null : 1,
        failedPage: acceptance.accepted ? null : 1,
        failureReason: shortMsg,
        durationMs,
        source: sourceKind,
      });
      clearCachedReconciliation(scope.userId);
      return jsonSyncResult({
        status,
        recordsProcessed,
        durationMs,
        pageSize,
        complete: acceptance.accepted,
        nextPage: acceptance.accepted ? null : 1,
        failedPage: acceptance.accepted ? null : 1,
        syncErrors: errors.slice(0, 20),
        skipped,
        lastCommittedPage: Math.max(1, pagesFetched),
        cin7Count: expectedTaxCodes ?? null,
        completenessMessage: shortMsg,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startedAt;
      const shortMsg = buildShortSyncIncompleteMessage({
        synced: optixFloor,
        expected: expectedSourceCount,
        reason: message,
      });
      await persistCin7SyncRunCheckpoint({
        runId: run.id,
        status: 'incomplete',
        recordsProcessed: optixFloor,
        pagesFetched: 0,
        lastCommittedPage: 0,
        nextPage: 1,
        failedPage: 1,
        failureReason: shortMsg,
        durationMs,
        source: sourceKind,
      });
      return jsonSyncResult({
        status: 'incomplete',
        recordsProcessed: optixFloor,
        durationMs,
        pageSize,
        complete: false,
        nextPage: 1,
        failedPage: 1,
        syncErrors: [message],
        skipped,
        cin7Count: expectedSourceCount,
        completenessMessage: shortMsg,
      });
    }
  }

  // Orders: count-only, single shot (no paging). Cin7 Total is the confirmed source count.
  if (entityType === 'orders') {
    const startedAt = Date.now();
    let recordsProcessed = 0;
    try {
      if (useCore && coreCreds) {
        recordsProcessed = await fetchCin7SaleTotal(coreCreds);
      } else if (useOmni && omniCreds) {
        recordsProcessed = await fetchOmniSalesOrderCount(omniCreds);
      }
      const durationMs = Date.now() - startedAt;
      await persistCin7SyncRunCheckpoint({
        runId: run.id,
        status: 'complete',
        recordsProcessed,
        pagesFetched: 1,
        lastCommittedPage: 1,
        nextPage: null,
        failedPage: null,
        failureReason: null,
        durationMs,
        source: sourceKind,
      });
      clearCachedReconciliation(scope.userId);
      return jsonSyncResult({
        status: 'complete',
        recordsProcessed,
        durationMs,
        pageSize,
        complete: true,
        nextPage: null,
        failedPage: null,
        syncErrors: [],
        skipped,
        lastCommittedPage: 1,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startedAt;
      await persistCin7SyncRunCheckpoint({
        runId: run.id,
        status: 'incomplete',
        recordsProcessed: 0,
        pagesFetched: 0,
        lastCommittedPage: 0,
        nextPage: 1,
        failedPage: 1,
        failureReason: message,
        durationMs,
        source: sourceKind,
      });
      return jsonSyncResult({
        status: 'incomplete',
        recordsProcessed: 0,
        durationMs,
        pageSize,
        complete: false,
        nextPage: 1,
        failedPage: 1,
        syncErrors: [message],
        skipped,
      });
    }
  }

  // Accumulator for derived reference entities across product pages.
  const derivedAccum = {
    brands: new Set<string>(),
    priceColumns: new Set<string>(),
    unitsOfMeasure: new Set<string>(),
  };

  type EngineFetch = Parameters<typeof runPagedSyncEngine>[0]['fetchPage'];

  let fetchPage: EngineFetch | null = null;
  let hardError: string | null = null;

  if (entityType === 'products') {
    if (useCore && coreCreds) {
      fetchPage = async (page) => {
        const { rows, total } = await fetchCin7ProductPage(coreCreds, page, pageSize);
        return {
          sourceRowCount: rows.length,
          total,
          error: undefined,
          persist: async () => {
        cin7SourceStyles += rows.length;
            const n = await batchUpsertProducts(scope.userId, mapCoreProductRows(rows));
            return { recordsProcessed: n };
          },
        };
      };
    } else if (useOmni && omniCreds) {
      fetchPage = async (page) => {
        const { rows, sourceRowCount, total, skippedInactive, error } = await fetchOmniProductPage(
          omniCreds,
          page,
          pageSize,
          { excludeInactive: false, where: incrementalWhere ?? undefined }
        );
        return {
          sourceRowCount,
          total,
          error,
          persist: async () => {
            skipped.inactive_products += skippedInactive;
            cin7SourceStyles += sourceRowCount;
            const n = await batchUpsertProducts(scope.userId, mapOmniProductRows(rows));
            return { recordsProcessed: n };
          },
        };
      };
    }
  } else if (entityType === 'customers' || entityType === 'internal-customers') {
    const contactType = entityType === 'internal-customers' ? 'Internal' : 'Customer';
    if (useCore && coreCreds && entityType === 'customers') {
      fetchPage = async (page) => {
        const { rows } = await fetchCin7CustomerPage(coreCreds, page, pageSize);
        return {
          sourceRowCount: rows.length,
          persist: async () => {
        const mapped = mapCoreCustomerRows(rows);
        skipped.missing_core_id += rows.length - mapped.length;
            const n = await batchUpsertCustomers(scope.userId, mapped);
            return { recordsProcessed: n };
          },
        };
      };
    } else if (useOmni && omniCreds) {
      // Unfiltered Contacts pages + client type filter — matches live recon catalog.
      // Server-side where=type='Customer' under-counts vs the full feed.
      fetchPage = async (page) => {
        const {
          rows,
          sourceRowCount,
          total,
          skippedMissingId,
          skippedWrongType,
          skippedRecords,
          error,
        } = await fetchOmniContactsPage(omniCreds, page, pageSize, {
          allowedTypes: [contactType],
          where: incrementalWhere ?? undefined,
        });
        return {
          sourceRowCount,
          total,
          error,
          persist: async () => {
            skipped.missing_cin7_id += skippedMissingId;
            skipped.wrong_contact_type += skippedWrongType;
            for (const record of skippedRecords) {
              skipRecords.push({
                cin7Id: record.cin7Id ?? `page-${page}-missing-id`,
                label: record.label,
                reason: record.reason,
              });
            }
            const n = await batchUpsertCustomers(scope.userId, mapOmniCustomerRows(rows));
            return { recordsProcessed: n };
          },
        };
      };
    } else if (entityType === 'internal-customers') {
      hardError = 'Internal customer sync requires Cin7 Omni.';
    }
  } else if (entityType === 'branches') {
    if (useOmni && omniCreds) {
      fetchPage = async (page) => {
        const { rows, sourceRowCount, total, skippedMissingId, error } =
          await fetchOmniBranchesPage(omniCreds, page, pageSize);
        return {
          sourceRowCount,
          total,
          error,
          persist: async () => {
            skipped.missing_cin7_id += skippedMissingId;
            const n = await batchUpsertBranches(scope.userId, mapOmniBranchRows(rows));
            return { recordsProcessed: n };
          },
        };
      };
    } else {
      hardError = 'Branch sync requires Cin7 Omni (/v1/Branches).';
    }
  } else if (entityType === 'suppliers') {
    if (useOmni && omniCreds) {
      fetchPage = async (page) => {
        const {
          rows,
          sourceRowCount,
          total,
          skippedMissingId,
          skippedWrongType,
          skippedRecords,
          error,
        } = await fetchOmniContactsPage(omniCreds, page, pageSize, {
          allowedTypes: ['Supplier'],
          where: incrementalWhere ?? undefined,
        });
        return {
          sourceRowCount,
          total,
          error,
          persist: async () => {
            skipped.missing_cin7_id += skippedMissingId;
            skipped.wrong_contact_type += skippedWrongType;
            for (const record of skippedRecords) {
              skipRecords.push({
                cin7Id: record.cin7Id ?? `page-${page}-missing-id`,
                label: record.label,
                reason: record.reason,
              });
            }
            const n = await batchUpsertSuppliers(scope.userId, mapOmniSupplierRows(rows));
            return { recordsProcessed: n };
          },
        };
      };
    } else {
      hardError = 'Supplier sync requires Cin7 Omni (contact type Supplier).';
    }
  } else if (entityType === 'product-categories') {
    if (!useOmni || !omniCreds) {
      hardError = 'Product category sync requires Cin7 Omni (/v1/ProductCategories).';
    } else {
      fetchPage = async (page) => {
        const { rows, sourceRowCount, total, error } = await fetchOmniProductCategoriesPage(
          omniCreds,
          page,
          pageSize
        );
        return {
          sourceRowCount,
          total,
          error,
          persist: async () => {
            const n = await batchUpsertProductCategories(scope.userId, rows);
            return { recordsProcessed: n };
          },
        };
      };
    }
  } else if (
    entityType === 'brands' ||
    entityType === 'price-lists' ||
    entityType === 'units-of-measure'
  ) {
    if (!useOmni || !omniCreds) {
      hardError = `${entityType} sync requires Cin7 Omni.`;
    } else {
      fetchPage = async (page) => {
        const { rows, sourceRowCount, total, error } = await fetchOmniProductsRawPage(
          omniCreds,
          page,
          pageSize,
          { where: incrementalWhere ?? undefined }
        );
        return {
          sourceRowCount,
          total,
          error,
          persist: async () => {
            const extracted = extractReferenceDataFromProducts(rows);
            // Count only newly discovered keys — re-upserting the full unique set each
            // page was inflating Recent sync (e.g. 400 / 4606) far above Optix rows.
            const brandsBefore = derivedAccum.brands.size;
            const priceBefore = derivedAccum.priceColumns.size;
            const uomBefore = derivedAccum.unitsOfMeasure.size;
            for (const b of extracted.brands) derivedAccum.brands.add(b);
            for (const c of extracted.priceColumns) derivedAccum.priceColumns.add(c);
            for (const u of extracted.unitsOfMeasure) derivedAccum.unitsOfMeasure.add(u);

            if (entityType === 'brands') {
              await batchUpsertBrands(scope.userId, [...derivedAccum.brands].sort());
              return { recordsProcessed: derivedAccum.brands.size - brandsBefore };
            }
            if (entityType === 'price-lists') {
              await batchUpsertPriceLists(
      scope.userId,
                mapPriceColumnLabels([...derivedAccum.priceColumns].sort())
              );
              return { recordsProcessed: derivedAccum.priceColumns.size - priceBefore };
            }
            await batchUpsertUnitsOfMeasure(scope.userId, [...derivedAccum.unitsOfMeasure].sort());
            return { recordsProcessed: derivedAccum.unitsOfMeasure.size - uomBefore };
          },
        };
      };
    }
  } else if (entityType === 'stock-levels') {
    if (!useOmni || !omniCreds) {
      hardError = 'Stock level sync requires Cin7 Omni (/v1/Stock).';
    } else {
      fetchPage = async (page) => {
        const { rows, sourceRowCount, total, error } = await fetchOmniStockPage(
          omniCreds,
          page,
          pageSize,
          { where: incrementalWhere ?? undefined }
        );
        return {
          sourceRowCount,
          total,
          error,
          persist: async () => {
            const mapped = mapOmniStockLevelRows(rows);
            const n = await batchUpsertStockLevels(scope.userId, mapped);
            if (stockWalk) {
              stockWalk = {
                ...stockWalk,
                keys: mergeStockWalkKeys(
                  stockWalk.keys,
                  mapped.map((row) => `${row.cin7BranchId}:${row.sku}`)
                ),
              };
              await prisma.cin7SyncRun.update({
                where: { id: run.id },
                data: {
                  skipped: writeStockWalkCheckpoint(
                    skipped,
                    stockWalk
                  ) as Prisma.InputJsonValue,
                },
              });
            }
            return { recordsProcessed: n };
          },
        };
      };
    }
  }

  if (hardError) {
    await persistCin7SyncRunCheckpoint({
      runId: run.id,
      status: 'incomplete',
      recordsProcessed: optixFloor,
      pagesFetched: 0,
      lastCommittedPage: 0,
      nextPage: 1,
      failedPage: 1,
      failureReason: hardError,
      durationMs: 0,
      source: sourceKind,
    });
    return NextResponse.json({ detail: hardError }, { status: 400 });
  }

  if (!fetchPage) {
    await persistCin7SyncRunCheckpoint({
      runId: run.id,
      status: 'incomplete',
      recordsProcessed: optixFloor,
      pagesFetched: 0,
      lastCommittedPage: 0,
      nextPage: 1,
      failedPage: 1,
      failureReason: 'No fetch strategy for entity/source combination.',
      durationMs: 0,
      source: sourceKind,
    });
      return NextResponse.json(
      { detail: 'No fetch strategy for entity/source combination.' },
        { status: 400 }
      );
    }

  // For derived entities on resume, reload prior Optix sets so accum isn't empty.
  if (
    !resetCheckpoint &&
    (entityType === 'brands' || entityType === 'price-lists' || entityType === 'units-of-measure')
  ) {
    // Accumulators restart empty within a process; upserts are full-set replaces of discovered
    // keys from pages in this chunk only. On resume mid-catalog, re-scan from startPage and
    // merge with DB-existing names so we don't wipe earlier pages.
    if (entityType === 'brands') {
      const existing = await prisma.cin7Brand.findMany({
        where: { ownerUserId: scope.userId },
        select: { name: true },
      });
      for (const row of existing) derivedAccum.brands.add(row.name);
    } else if (entityType === 'price-lists') {
      const existing = await prisma.cin7PriceList.findMany({
        where: { ownerUserId: scope.userId },
        select: { cin7PriceColumn: true },
      });
      for (const row of existing) derivedAccum.priceColumns.add(row.cin7PriceColumn);
    } else if (entityType === 'units-of-measure') {
      const existing = await prisma.cin7UnitOfMeasure.findMany({
        where: { ownerUserId: scope.userId },
        select: { code: true },
      });
      for (const row of existing) derivedAccum.unitsOfMeasure.add(row.code);
    }
  }

  const isContactEntity =
    entityType === 'customers' || entityType === 'internal-customers' || entityType === 'suppliers';

  let result = await runPagedSyncEngine({
    ownerUserId: scope.userId,
    entityType: rawEntityType,
    runId: run.id,
    startPage,
    timeBudgetMs,
    pageSize,
    pageGapMs,
    maxPages,
    // Contact feeds occasionally return a transient empty page mid-catalog.
    emptyEofConfirms: isContactEntity ? 2 : 1,
    priorRecordsProcessed: priorRecords,
    recordFloor: optixFloor,
    refreshRecordCount: () => getOptixEntityRecordCount(scope.userId, rawEntityType),
    fetchPage,
  });

  // Price lists recon includes customer PriceColumn values; product scan alone misses those.
  if (entityType === 'price-lists' && result.status === 'complete' && useOmni && omniCreds) {
    try {
      const customers = await fetchFullOmniContactsByType(omniCreds, ['Customer']);
      const before = derivedAccum.priceColumns.size;
      for (const contact of customers.contacts) {
        const col = contact.priceColumn?.trim();
        if (col) derivedAccum.priceColumns.add(col);
      }
      await batchUpsertPriceLists(
        scope.userId,
        mapPriceColumnLabels([...derivedAccum.priceColumns].sort())
      );
      const added = derivedAccum.priceColumns.size - before;
      result = {
        ...result,
        recordsProcessed: derivedAccum.priceColumns.size,
        syncErrors: [...result.syncErrors, ...customers.errors].slice(0, 20),
      };
      if (customers.errors.length > 0) {
        result = {
          ...result,
          status: 'incomplete',
          complete: false,
          nextPage: result.lastCommittedPage > 0 ? result.lastCommittedPage + 1 : 1,
          failureReason: `Customer price-column walk incomplete: ${customers.errors.slice(0, 2).join('; ')}`,
        };
      }
      if (added > 0) {
        console.log(
          `[Cin7 sync] price-lists: merged ${added} customer price columns → ${derivedAccum.priceColumns.size} total`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result = {
        ...result,
        status: 'incomplete',
        complete: false,
        nextPage: result.lastCommittedPage > 0 ? result.lastCommittedPage + 1 : 1,
        failureReason: `Product price columns synced; customer price columns failed: ${message}`,
        syncErrors: [...result.syncErrors, message].slice(0, 20),
      };
    }
  }

  // Authoritative Optix count for the final ledger. Stock extras are removed
  // inside a complete full walk (below), not left for a later freeze prune.
  let optixAfter = await getOptixEntityRecordCount(scope.userId, rawEntityType);
  const skipCountCheck = entityType === 'orders';
  {
    result = {
      ...result,
      recordsProcessed: finalizeSyncRecordCount({
        optixCount: optixAfter,
        thisRunProcessed: result.recordsProcessed,
        countOnly: skipCountCheck,
      }),
    };
  }

  // Fail-closed acceptance: Complete only when Optix matches known Cin7 floor + no errors.
  // Prefer max(recon cache, live envelope Total) so count checks work for both response shapes.
  const cin7Expected = resolveCin7ExpectedCount(expectedSourceCount, result.reportedTotal);
  const acceptance = assertCin7SyncAcceptance({
    optixCount: optixAfter,
    cin7Expected,
    syncErrors: result.syncErrors,
    skipCountCheck,
  });

  if (result.status === 'complete' && !acceptance.accepted) {
    const shortReason = buildShortSyncIncompleteMessage({
      synced: optixAfter,
      expected: cin7Expected,
      reason: acceptance.reason,
    });
    result = {
      ...result,
      status: 'incomplete',
      complete: false,
      nextPage:
        result.nextPage ?? (result.lastCommittedPage > 0 ? result.lastCommittedPage + 1 : 1),
      failedPage: result.failedPage ?? 1,
      failureReason: shortReason,
      syncErrors: [...result.syncErrors, acceptance.reason ?? 'Acceptance failed'].slice(0, 20),
    };
  } else if (
    shouldPromoteCin7SyncComplete({
      status: result.status,
      optixCount: optixAfter,
      cin7Expected,
      syncErrors: result.syncErrors,
      skipCountCheck,
    })
  ) {
    result = {
      ...result,
      status: 'complete',
      complete: true,
      nextPage: null,
      failedPage: null,
      failureReason: null,
    };
  }

  if (isStockEntity && stockWalk && result.status === 'complete' && result.complete) {
    const truncated =
      typeof result.reportedTotal === 'number' &&
      result.reportedTotal > 0 &&
      result.sourceRowsFetched < result.reportedTotal;
    const walkDeletes = await runAuditedStockWalkDeletes({
      ownerUserId: scope.userId,
      actorUserId: scope.userId,
      keys: stockWalk.keys,
      walkKind: stockWalk.kind,
      complete: true,
      truncated,
      syncErrors: result.syncErrors,
      reportedTotal: result.reportedTotal,
      priorCompleteFullKeys: stockWalk.priorCompleteFullKeys,
    });
    skipped.stock_deletes = {
      allowed: walkDeletes.allowed,
      reason: walkDeletes.reason,
      deleted: walkDeletes.deleted,
      audit_run_id: walkDeletes.audit_run_id,
    };
    if (walkDeletes.allowed) {
      console.log(
        `[Cin7 sync] stock-levels: walk deletes allowed deleted=${walkDeletes.deleted} keys=${walkDeletes.cin7_keys}`
      );
    } else {
      console.log(`[Cin7 sync] stock-levels: walk deletes skipped — ${walkDeletes.reason}`);
    }
  }

  optixAfter = await getOptixEntityRecordCount(scope.userId, rawEntityType);
  result = {
    ...result,
    recordsProcessed: finalizeSyncRecordCount({
      optixCount: optixAfter,
      thisRunProcessed: result.recordsProcessed,
      countOnly: skipCountCheck,
    }),
  };

  // Always persist a short incompleteness line when still short of Cin7 / paused.
  if (result.status !== 'complete' || result.complete === false) {
    result = {
      ...result,
      failureReason: buildShortSyncIncompleteMessage({
        synced: result.recordsProcessed,
        expected: cin7Expected,
        reason: result.failureReason,
      }),
    };
  }

  // Attach skipped + source on final checkpoint write.
  const skippedForPersist = (
    stockWalk
      ? writeStockWalkCheckpoint(skipped as unknown as Record<string, unknown>, stockWalk)
      : skipped
  ) as Prisma.InputJsonValue;
  await persistCin7SyncRunCheckpoint({
    runId: run.id,
    status: result.status,
    recordsProcessed: result.recordsProcessed,
    pagesFetched: result.pagesFetched,
    lastCommittedPage: result.lastCommittedPage,
    nextPage: result.nextPage,
    failedPage: result.failedPage,
    failureReason: result.failureReason,
    durationMs: result.durationMs,
    skipped: skippedForPersist,
    source: sourceKind,
  });

  // Keep alias tiles (inventory ↔ stock-levels, warehouses ↔ branches) in lockstep.
  const aliasEntity =
    rawEntityType === 'stock-levels'
      ? 'inventory'
      : rawEntityType === 'inventory'
        ? 'stock-levels'
        : rawEntityType === 'branches'
          ? 'warehouses'
          : rawEntityType === 'warehouses'
            ? 'branches'
            : null;
  if (aliasEntity) {
    const aliasRun = await loadOrCreateCin7SyncRun({
      ownerUserId: scope.userId,
      entityType: aliasEntity,
    });
    await persistCin7SyncRunCheckpoint({
      runId: aliasRun.id,
      status: result.status,
      recordsProcessed: result.recordsProcessed,
      pagesFetched: result.pagesFetched,
      lastCommittedPage: result.lastCommittedPage,
      nextPage: result.nextPage,
      failedPage: result.failedPage,
      failureReason: result.failureReason,
      durationMs: result.durationMs,
      skipped: skippedForPersist,
      source: sourceKind,
    });
  }

  if (skipRecords.length > 0) {
    await prisma.cin7SyncSkipRecord
      .deleteMany({ where: { syncRunId: run.id } })
      .catch(() => undefined);
    const batchSize = 500;
    for (let i = 0; i < skipRecords.length; i += batchSize) {
      const chunk = skipRecords.slice(i, i + batchSize);
      await prisma.cin7SyncSkipRecord
        .createMany({
          data: chunk.map((row) => ({
            ownerUserId: scope.userId,
            syncRunId: run.id,
            entityType: rawEntityType,
            cin7Id: row.cin7Id,
            label: row.label,
            reason: row.reason,
          })),
        })
        .catch(() => undefined);
    }
  }

  clearCachedReconciliation(scope.userId);

  console.log(
    `[Cin7 sync] ${rawEntityType}: status=${result.status} records=${result.recordsProcessed} page=${result.lastCommittedPage} in ${result.durationMs}ms (${sourceKind})`
  );

  return jsonSyncResult({
    status: result.status,
    recordsProcessed: result.recordsProcessed,
    durationMs: result.durationMs,
    pageSize,
    complete: result.complete,
    nextPage: result.nextPage,
    failedPage: result.failedPage,
    syncErrors: result.syncErrors,
    skipped,
    cin7SourceStyles,
    lastCommittedPage: result.lastCommittedPage,
    cin7Count: cin7Expected,
    completenessMessage:
      result.status !== 'complete' || result.complete === false ? result.failureReason : null,
  });
}
