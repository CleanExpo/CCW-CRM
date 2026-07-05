import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScopeOrCronIntegrationJob } from '@/lib/auth/data-scope';
import {
  fetchCin7CustomerPage,
  fetchCin7ProductPage,
  fetchCin7SaleTotal,
  getCin7CoreCredentials,
  pingCin7Core,
} from '@/lib/integrations/cin7-core';
import {
  fetchOmniBranchesPage,
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
  batchUpsertBranches,
  batchUpsertCustomers,
  batchUpsertProducts,
  batchUpsertSuppliers,
  mapCoreCustomerRows,
  mapCoreProductRows,
  mapOmniBranchRows,
  mapOmniCustomerRows,
  mapOmniProductRows,
  mapOmniSupplierRows,
  recordCin7SyncRun,
} from '@/lib/integrations/cin7-sync-persist';

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

  const { entityType } = await context.params;
  const allowed = [
    'products',
    'customers',
    'internal-customers',
    'suppliers',
    'branches',
    'orders',
    'inventory',
  ] as const;
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
  let cin7SourceStyles = 0;
  const skipped: SyncSkipped = {
    wrong_contact_type: 0,
    missing_cin7_id: 0,
    inactive_products: 0,
    missing_core_id: 0,
  };
  const startedAt = Date.now();

  if (entityType === 'products' || entityType === 'inventory') {
    if (useCore && coreCreds) {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total } = await fetchCin7ProductPage(coreCreds, page, pageSize);
        if (rows.length === 0) break;
        cin7SourceStyles += rows.length;
        recordsProcessed += await batchUpsertProducts(scope.userId, mapCoreProductRows(rows));
        if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, MAX_PAGES)) break;
      }
    } else if (useOmni && omniCreds) {
      type OmniProductPage = Awaited<ReturnType<typeof fetchOmniProductPage>>;
      let nextFetch: Promise<OmniProductPage> = fetchOmniProductPage(omniCreds, 1, pageSize, {
        excludeInactive: true,
      });

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total, sourceRowCount, skippedInactive } = await nextFetch;
        if (sourceRowCount === 0) break;

        skipped.inactive_products += skippedInactive;
        cin7SourceStyles += sourceRowCount;

        const nextPage = page + 1;
        nextFetch =
          nextPage <= MAX_PAGES
            ? fetchOmniProductPage(omniCreds, nextPage, pageSize, { excludeInactive: true })
            : Promise.resolve({
                rows: [],
                total: null,
                sourceRowCount: 0,
                skippedInactive: 0,
              });

        recordsProcessed += await batchUpsertProducts(scope.userId, mapOmniProductRows(rows));
        if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, total, MAX_PAGES)) break;
      }
    }
  } else if (entityType === 'customers' || entityType === 'internal-customers') {
    const contactTypes =
      entityType === 'internal-customers' ? (['Internal'] as const) : (['Customer'] as const);
    if (useCore && coreCreds && entityType === 'customers') {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total } = await fetchCin7CustomerPage(coreCreds, page, pageSize);
        if (rows.length === 0) break;
        const mapped = mapCoreCustomerRows(rows);
        skipped.missing_core_id += rows.length - mapped.length;
        recordsProcessed += await batchUpsertCustomers(scope.userId, mapped);
        if (!shouldContinueCin7SyncPage(page, pageSize, rows.length, total, MAX_PAGES)) break;
      }
    } else if (useOmni && omniCreds) {
      type OmniContactPage = Awaited<ReturnType<typeof fetchOmniContactsPage>>;
      let nextFetch: Promise<OmniContactPage> = fetchOmniContactsPage(omniCreds, 1, pageSize, {
        allowedTypes: [...contactTypes],
      });

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total, sourceRowCount, skippedMissingId, skippedWrongType } =
          await nextFetch;
        if (sourceRowCount === 0) break;

        skipped.missing_cin7_id += skippedMissingId;
        skipped.wrong_contact_type += skippedWrongType;

        const nextPage = page + 1;
        nextFetch =
          nextPage <= MAX_PAGES
            ? fetchOmniContactsPage(omniCreds, nextPage, pageSize, {
                allowedTypes: [...contactTypes],
              })
            : Promise.resolve({
                rows: [],
                total: null,
                sourceRowCount: 0,
                skippedWrongType: 0,
                skippedMissingId: 0,
              });

        recordsProcessed += await batchUpsertCustomers(scope.userId, mapOmniCustomerRows(rows));
        if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, total, MAX_PAGES)) break;
      }
    } else if (entityType === 'internal-customers') {
      return NextResponse.json(
        { detail: 'Internal customer sync requires Cin7 Omni.' },
        { status: 400 }
      );
    }
  } else if (entityType === 'branches') {
    if (useOmni && omniCreds) {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total, sourceRowCount, skippedMissingId } = await fetchOmniBranchesPage(
          omniCreds,
          page,
          pageSize
        );
        if (sourceRowCount === 0) break;
        skipped.missing_cin7_id += skippedMissingId;
        recordsProcessed += await batchUpsertBranches(scope.userId, mapOmniBranchRows(rows));
        if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, total, MAX_PAGES)) break;
      }
    } else {
      return NextResponse.json(
        { detail: 'Branch sync requires Cin7 Omni (/v1/Branches).' },
        { status: 400 }
      );
    }
  } else if (entityType === 'suppliers') {
    if (useOmni && omniCreds) {
      type OmniContactPage = Awaited<ReturnType<typeof fetchOmniContactsPage>>;
      let nextFetch: Promise<OmniContactPage> = fetchOmniContactsPage(omniCreds, 1, pageSize, {
        allowedTypes: ['Supplier'],
      });

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total, sourceRowCount, skippedMissingId, skippedWrongType } =
          await nextFetch;
        if (sourceRowCount === 0) break;

        skipped.missing_cin7_id += skippedMissingId;
        skipped.wrong_contact_type += skippedWrongType;

        const nextPage = page + 1;
        nextFetch =
          nextPage <= MAX_PAGES
            ? fetchOmniContactsPage(omniCreds, nextPage, pageSize, {
                allowedTypes: ['Supplier'],
              })
            : Promise.resolve({
                rows: [],
                total: null,
                sourceRowCount: 0,
                skippedWrongType: 0,
                skippedMissingId: 0,
              });

        recordsProcessed += await batchUpsertSuppliers(scope.userId, mapOmniSupplierRows(rows));
        if (!shouldContinueCin7SyncPage(page, pageSize, sourceRowCount, total, MAX_PAGES)) break;
      }
    } else {
      return NextResponse.json(
        { detail: 'Supplier sync requires Cin7 Omni (contact type Supplier).' },
        { status: 400 }
      );
    }
  } else if (entityType === 'orders') {
    if (useCore && coreCreds) {
      recordsProcessed = await fetchCin7SaleTotal(coreCreds);
    } else if (useOmni && omniCreds) {
      recordsProcessed = await fetchOmniSalesOrderCount(omniCreds);
    }
  }

  const durationMs = Date.now() - startedAt;
  const source = useCore ? 'core' : 'omni';
  console.log(
    `[Cin7 sync] ${entityType}: ${recordsProcessed} records in ${durationMs}ms (${source})`
  );

  await recordCin7SyncRun({
    ownerUserId: scope.userId,
    entityType,
    recordsProcessed,
    skipped,
    durationMs,
    source,
  }).catch(() => undefined);

  return NextResponse.json({
    status: 'ok',
    records_processed: recordsProcessed,
    cin7_source_styles: cin7SourceStyles || undefined,
    skipped,
    duration_ms: durationMs,
    page_size: pageSize,
  });
}
