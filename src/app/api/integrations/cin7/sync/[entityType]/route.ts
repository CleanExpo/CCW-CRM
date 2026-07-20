import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import {
  fetchDerivedReferenceCatalog,
  fetchFullOmniProductsRawCatalog,
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
import {
  extractReferenceDataFromProducts,
  fetchOmniSalesOrderCount,
  getCin7OmniCredentials,
  pingCin7Omni,
} from '@/lib/integrations/cin7-omni';
import { clearCachedReconciliation } from '@/lib/integrations/cin7-reconciliation-cache';
import {
  getCin7PageSize,
  getCin7SyncMaxPages,
  shouldContinueCin7SyncPage,
} from '@/lib/integrations/cin7-sync-config';
import {
  syncOmniBranches,
  syncOmniContacts,
  syncOmniProductCategories,
  syncOmniProducts,
  syncOmniStockLevels,
} from '@/lib/integrations/cin7-sync-omni-handlers';
import {
  batchUpsertBrands,
  batchUpsertCustomers,
  batchUpsertPriceLists,
  batchUpsertProducts,
  batchUpsertTaxCodes,
  batchUpsertUnitsOfMeasure,
  mapCoreCustomerRows,
  mapCoreProductRows,
  recordCin7SyncRun,
  type Cin7SyncSkipInput,
} from '@/lib/integrations/cin7-sync-persist';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

const MAX_PAGES = getCin7SyncMaxPages();

type SyncSkipped = {
  wrong_contact_type: number;
  missing_cin7_id: number;
  inactive_products: number;
  missing_core_id: number;
};

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
  let recordsProcessed = 0;
  let cin7SourceStyles = 0;
  const skipped: SyncSkipped = {
    wrong_contact_type: 0,
    missing_cin7_id: 0,
    inactive_products: 0,
    missing_core_id: 0,
  };
  const skipRecords: Cin7SyncSkipInput[] = [];
  const startedAt = Date.now();

  const startPage = Math.max(Number(request.nextUrl.searchParams.get('start_page')) || 1, 1);

  let syncComplete = true;
  let syncTimedOut = false;
  let nextPage: number | null = null;
  let pagesFetched = 0;
  const syncErrors: string[] = [];

  const applyOmniOutcome = (outcome: Awaited<ReturnType<typeof syncOmniProducts>>) => {
    recordsProcessed += outcome.recordsProcessed;
    pagesFetched = Math.max(pagesFetched, outcome.pagesFetched);
    skipped.wrong_contact_type += outcome.skipped.wrong_contact_type;
    skipped.missing_cin7_id += outcome.skipped.missing_cin7_id;
    skipped.inactive_products += outcome.skipped.inactive_products;
    skipRecords.push(...outcome.skipRecords);
    syncErrors.push(...outcome.errors);
    syncComplete = outcome.complete;
    syncTimedOut = outcome.timedOut;
    nextPage = outcome.nextPage;
    if (outcome.cin7SourceStyles) {
      cin7SourceStyles += outcome.cin7SourceStyles;
    }
  };

  if (entityType === 'products') {
    if (useCore && coreCreds) {
      let coreStoppedEarly = false;
      for (let page = startPage; page <= MAX_PAGES; page += 1) {
        const { rows, total } = await fetchCin7ProductPage(coreCreds, page, pageSize);
        if (rows.length === 0) {
          syncComplete = true;
          break;
        }
        cin7SourceStyles += rows.length;
        recordsProcessed += await batchUpsertProducts(scope.userId, mapCoreProductRows(rows));
        pagesFetched = page;
        if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, MAX_PAGES)) {
          // Full page with unknown/remaining total → hit max pages or mid-catalog stop
          if (rows.length >= pageSize && page >= MAX_PAGES) {
            syncComplete = false;
            nextPage = page + 1;
            syncErrors.push(`Stopped: reached max pages cap (${MAX_PAGES})`);
            coreStoppedEarly = true;
          } else {
            syncComplete = true;
          }
          break;
        }
      }
      if (!coreStoppedEarly && pagesFetched === 0) syncComplete = true;
    } else if (useOmni && omniCreds) {
      applyOmniOutcome(await syncOmniProducts(omniCreds, scope.userId, startPage));
    }
  } else if (entityType === 'customers' || entityType === 'internal-customers') {
    const contactType = entityType === 'internal-customers' ? 'Internal' : 'Customer';
    if (useCore && coreCreds && entityType === 'customers') {
      for (let page = startPage; page <= MAX_PAGES; page += 1) {
        const { rows, total } = await fetchCin7CustomerPage(coreCreds, page, pageSize);
        if (rows.length === 0) {
          syncComplete = true;
          break;
        }
        const mapped = mapCoreCustomerRows(rows);
        skipped.missing_core_id += rows.length - mapped.length;
        recordsProcessed += await batchUpsertCustomers(scope.userId, mapped);
        pagesFetched = page;
        if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, MAX_PAGES)) {
          if (rows.length >= pageSize && page >= MAX_PAGES) {
            syncComplete = false;
            nextPage = page + 1;
            syncErrors.push(`Stopped: reached max pages cap (${MAX_PAGES})`);
          } else {
            syncComplete = true;
          }
          break;
        }
      }
    } else if (useOmni && omniCreds) {
      applyOmniOutcome(await syncOmniContacts(omniCreds, scope.userId, contactType, startPage));
    } else if (entityType === 'internal-customers') {
      return NextResponse.json(
        { detail: 'Internal customer sync requires Cin7 Omni.' },
        { status: 400 }
      );
    }
  } else if (entityType === 'branches' || entityType === 'warehouses') {
    if (useOmni && omniCreds) {
      applyOmniOutcome(await syncOmniBranches(omniCreds, scope.userId, startPage));
    } else {
      return NextResponse.json(
        { detail: 'Branch sync requires Cin7 Omni (/v1/Branches).' },
        { status: 400 }
      );
    }
  } else if (entityType === 'suppliers') {
    if (useOmni && omniCreds) {
      applyOmniOutcome(await syncOmniContacts(omniCreds, scope.userId, 'Supplier', startPage));
    } else {
      return NextResponse.json(
        { detail: 'Supplier sync requires Cin7 Omni (contact type Supplier).' },
        { status: 400 }
      );
    }
  } else if (entityType === 'product-categories') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json(
        { detail: 'Product category sync requires Cin7 Omni (/v1/ProductCategories).' },
        { status: 400 }
      );
    }
    applyOmniOutcome(await syncOmniProductCategories(omniCreds, scope.userId, startPage));
  } else if (entityType === 'brands') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json({ detail: 'Brand sync requires Cin7 Omni.' }, { status: 400 });
    }
    const raw = await fetchFullOmniProductsRawCatalog(omniCreds);
    if (raw.errors.length > 0) {
      syncErrors.push(...raw.errors.slice(0, 10));
      syncComplete = false;
    }
    const { brands } = extractReferenceDataFromProducts(raw.styles);
    recordsProcessed = await batchUpsertBrands(scope.userId, brands);
  } else if (entityType === 'price-lists') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json({ detail: 'Price list sync requires Cin7 Omni.' }, { status: 400 });
    }
    const derived = await fetchDerivedReferenceCatalog(omniCreds);
    if (derived.errors.length > 0) {
      syncErrors.push(...derived.errors.slice(0, 10));
      syncComplete = false;
    }
    recordsProcessed = await batchUpsertPriceLists(
      scope.userId,
      mapPriceColumnLabels(derived.priceColumns)
    );
  } else if (entityType === 'tax-codes') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json({ detail: 'Tax code sync requires Cin7 Omni.' }, { status: 400 });
    }
    const derived = await fetchDerivedReferenceCatalog(omniCreds);
    if (derived.errors.length > 0) {
      syncErrors.push(...derived.errors.slice(0, 10));
      syncComplete = false;
    }
    recordsProcessed = await batchUpsertTaxCodes(scope.userId, derived.taxCodes);
  } else if (entityType === 'units-of-measure') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json(
        { detail: 'Unit of measure sync requires Cin7 Omni.' },
        { status: 400 }
      );
    }
    const raw = await fetchFullOmniProductsRawCatalog(omniCreds);
    if (raw.errors.length > 0) {
      syncErrors.push(...raw.errors.slice(0, 10));
      syncComplete = false;
    }
    const { unitsOfMeasure } = extractReferenceDataFromProducts(raw.styles);
    recordsProcessed = await batchUpsertUnitsOfMeasure(scope.userId, unitsOfMeasure);
  } else if (entityType === 'stock-levels') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json(
        { detail: 'Stock level sync requires Cin7 Omni (/v1/Stock).' },
        { status: 400 }
      );
    }
    applyOmniOutcome(await syncOmniStockLevels(omniCreds, scope.userId, startPage));
  } else if (entityType === 'orders') {
    if (useCore && coreCreds) {
      recordsProcessed = await fetchCin7SaleTotal(coreCreds);
    } else if (useOmni && omniCreds) {
      recordsProcessed = await fetchOmniSalesOrderCount(omniCreds);
    }
  }

  const durationMs = Date.now() - startedAt;
  const source = sourceKind;
  console.log(
    `[Cin7 sync] ${entityType}: ${recordsProcessed} records in ${durationMs}ms (${source})`
  );

  await recordCin7SyncRun({
    ownerUserId: scope.userId,
    entityType: rawEntityType,
    recordsProcessed,
    skipped,
    skipRecords,
    durationMs,
    source,
  }).catch((err) => {
    console.error(`[Cin7 sync] Failed to record sync run for ${entityType}:`, err);
  });

  clearCachedReconciliation(scope.userId);

  return NextResponse.json({
    status: syncComplete ? 'ok' : syncTimedOut ? 'partial' : 'incomplete',
    records_processed: recordsProcessed,
    cin7_source_styles: cin7SourceStyles || undefined,
    skipped,
    duration_ms: durationMs,
    page_size: pageSize,
    pages_fetched: pagesFetched || undefined,
    complete: syncComplete,
    timed_out: syncTimedOut,
    next_page: nextPage,
    start_page: startPage,
    sync_errors: syncErrors.length > 0 ? syncErrors.slice(0, 20) : undefined,
  });
}
