import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import {
  fetchCin7CustomerPage,
  fetchCin7ProductPage,
  fetchCin7SaleTotal,
  fetchCin7SupplierPage,
  getCin7CoreCredentials,
  pingCin7Core,
} from '@/lib/integrations/cin7-core';
import {
  fetchOmniContactsPage,
  fetchOmniProductPage,
  fetchOmniSalesOrderCount,
  getCin7OmniCredentials,
  pingCin7Omni,
} from '@/lib/integrations/cin7-omni';
import {
  getCin7PageSize,
  getCin7SyncMaxPages,
  shouldContinueCin7SyncPage,
} from '@/lib/integrations/cin7-sync-config';
import {
  addVisibilityCounts,
  getCin7VisibilityConfig,
  tallyProductVisibility,
  type Cin7VisibilityCounts,
} from '@/lib/integrations/cin7-visibility';
import {
  batchUpsertCustomers,
  batchUpsertProducts,
  batchUpsertSuppliers,
  mapCoreCustomerRows,
  mapCoreProductRows,
  mapCoreSupplierRows,
  mapOmniCustomerRows,
  mapOmniProductRows,
} from '@/lib/integrations/cin7-sync-persist';

export const maxDuration = 300;

const MAX_PAGES = getCin7SyncMaxPages();

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

  const { entityType } = await context.params;
  const allowed = ['products', 'customers', 'orders', 'inventory', 'suppliers'] as const;
  if (!allowed.includes(entityType as (typeof allowed)[number])) {
    return NextResponse.json({ detail: 'Unsupported entity type' }, { status: 400 });
  }

  const coreCreds = getCin7CoreCredentials(request);
  const omniCreds = getCin7OmniCredentials(request);

  const coreLive = coreCreds ? await pingCin7Core(coreCreds) : false;
  const omniLive = omniCreds ? await pingCin7Omni(omniCreds) : false;

  const useCore = coreLive;
  const useOmni = !coreLive && omniLive;

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
  let recordsSkipped = 0;
  // UNI-2259 groundwork: env-gated visibility tally (null = feature off, response unchanged).
  // Only armed where a tally can actually run — Core products/inventory — so other entity
  // types and the Omni path never return misleading all-zero counts.
  const visibilityConfig = getCin7VisibilityConfig();
  const visibilityCounts: Cin7VisibilityCounts | null =
    visibilityConfig && useCore && (entityType === 'products' || entityType === 'inventory')
      ? { secure_internal: 0, show_public: 0, unknown: 0 }
      : null;
  const startedAt = Date.now();

  if (entityType === 'products' || entityType === 'inventory') {
    if (useCore && coreCreds) {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total } = await fetchCin7ProductPage(coreCreds, page, pageSize);
        if (rows.length === 0) break;
        if (visibilityConfig && visibilityCounts) {
          // Tally on the raw rows — the mapper drops the arbitrary Cin7 fields.
          addVisibilityCounts(visibilityCounts, tallyProductVisibility(rows, visibilityConfig));
        }
        const mapped = mapCoreProductRows(rows);
        recordsSkipped += mapped.skipped.length;
        recordsProcessed += await batchUpsertProducts(scope.userId, mapped.rows);
        if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, MAX_PAGES)) break;
      }
    } else if (useOmni && omniCreds) {
      type OmniProductPage = Awaited<ReturnType<typeof fetchOmniProductPage>>;
      let nextFetch: Promise<OmniProductPage> = fetchOmniProductPage(omniCreds, 1, pageSize);

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total, sourceRowCount } = await nextFetch;
        if (sourceRowCount === 0) break;

        const nextPage = page + 1;
        nextFetch =
          nextPage <= MAX_PAGES
            ? fetchOmniProductPage(omniCreds, nextPage, pageSize)
            : Promise.resolve({ rows: [], total: null, sourceRowCount: 0 });

        const mapped = mapOmniProductRows(rows);
        recordsSkipped += mapped.skipped.length;
        recordsProcessed += await batchUpsertProducts(scope.userId, mapped.rows);
        if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, total, MAX_PAGES)) break;
      }
    }
  } else if (entityType === 'customers') {
    if (useCore && coreCreds) {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total } = await fetchCin7CustomerPage(coreCreds, page, pageSize);
        if (rows.length === 0) break;
        recordsProcessed += await batchUpsertCustomers(scope.userId, mapCoreCustomerRows(rows));
        if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, MAX_PAGES)) break;
      }
    } else if (useOmni && omniCreds) {
      type OmniContactPage = Awaited<ReturnType<typeof fetchOmniContactsPage>>;
      let nextFetch: Promise<OmniContactPage> = fetchOmniContactsPage(omniCreds, 1, pageSize);

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total, sourceRowCount } = await nextFetch;
        if (sourceRowCount === 0) break;

        const nextPage = page + 1;
        nextFetch =
          nextPage <= MAX_PAGES
            ? fetchOmniContactsPage(omniCreds, nextPage, pageSize)
            : Promise.resolve({ rows: [], total: null, sourceRowCount: 0 });

        recordsProcessed += await batchUpsertCustomers(scope.userId, mapOmniCustomerRows(rows));
        if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, total, MAX_PAGES)) break;
      }
    }
  } else if (entityType === 'orders') {
    if (useCore && coreCreds) {
      recordsProcessed = await fetchCin7SaleTotal(coreCreds);
    } else if (useOmni && omniCreds) {
      recordsProcessed = await fetchOmniSalesOrderCount(omniCreds);
    }
  } else if (entityType === 'suppliers') {
    if (useCore && coreCreds) {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total } = await fetchCin7SupplierPage(coreCreds, page, pageSize);
        if (rows.length === 0) break;
        const mapped = mapCoreSupplierRows(rows);
        recordsSkipped += mapped.skipped.length;
        recordsProcessed += await batchUpsertSuppliers(scope.userId, mapped.rows);
        if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, MAX_PAGES)) break;
      }
    } else if (useOmni && omniCreds) {
      // Supplier sync via Cin7 Omni is not implemented yet — Omni exposes suppliers as
      // supplier-type Contacts, which needs a distinct filter/mapping. Core is the
      // supported path (UNI-2256). Follow-up: add Omni supplier support if needed.
      console.warn(
        '[Cin7 sync] suppliers: Omni supplier sync not implemented; connect Cin7 Core to sync suppliers'
      );
    }
  }

  const durationMs = Date.now() - startedAt;
  const visibilitySummary = visibilityCounts
    ? ` | visibility: ${visibilityCounts.secure_internal} secure, ${visibilityCounts.show_public} public, ${visibilityCounts.unknown} unknown`
    : '';
  console.log(
    `[Cin7 sync] ${entityType}: ${recordsProcessed} records, ${recordsSkipped} skipped in ${durationMs}ms (${useCore ? 'core' : 'omni'})${visibilitySummary}`
  );

  return NextResponse.json({
    status: 'ok',
    records_processed: recordsProcessed,
    records_skipped: recordsSkipped,
    duration_ms: durationMs,
    page_size: pageSize,
    // Present only when CIN7_PRODUCT_VISIBILITY_FIELD is configured (UNI-2259).
    ...(visibilityCounts ? { visibility_counts: visibilityCounts } : {}),
  });
}
