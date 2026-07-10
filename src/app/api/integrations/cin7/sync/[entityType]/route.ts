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
  fetchDerivedReferenceCatalog,
  fetchFullOmniProductCategoryCatalog,
  fetchFullOmniProductsRawCatalog,
  fetchFullOmniStockCatalog,
  mapPriceColumnLabels,
  resolveCin7SyncSource,
} from '@/lib/integrations/cin7-catalog-fetch';
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
  recordCin7SyncRun,
  type Cin7SyncSkipInput,
} from '@/lib/integrations/cin7-sync-persist';
import { getCatalogPageGapMs } from '@/lib/integrations/cin7-catalog-fetch';
import {
  extractReferenceDataFromProducts,
  fetchOmniProductCategoriesPage,
  fetchOmniStockPage,
} from '@/lib/integrations/cin7-omni';
import { resolveCin7SyncEntityAlias } from '@/lib/integrations/cin7-master-entities';

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
  const pageGapMs = getCatalogPageGapMs();
  const startedAt = Date.now();

  if (entityType === 'products') {
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
        excludeInactive: false,
      });

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, total, sourceRowCount, skippedInactive } = await nextFetch;
        if (sourceRowCount === 0) break;

        skipped.inactive_products += skippedInactive;
        cin7SourceStyles += sourceRowCount;

        const nextPage = page + 1;
        nextFetch =
          nextPage <= MAX_PAGES
            ? fetchOmniProductPage(omniCreds, nextPage, pageSize, { excludeInactive: false })
            : Promise.resolve({
                rows: [],
                total: null,
                sourceRowCount: 0,
                skippedInactive: 0,
              });

        recordsProcessed += await batchUpsertProducts(scope.userId, mapOmniProductRows(rows));
        if (sourceRowCount < pageSize) break;
        if (page >= MAX_PAGES) break;
      }
    }
  } else if (entityType === 'customers' || entityType === 'internal-customers') {
    const contactType = entityType === 'internal-customers' ? 'Internal' : 'Customer';
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
        whereType: contactType,
      });

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, sourceRowCount, skippedMissingId, skippedWrongType, skippedRecords } =
          await nextFetch;
        if (sourceRowCount === 0) break;

        skipped.missing_cin7_id += skippedMissingId;
        skipped.wrong_contact_type += skippedWrongType;
        for (const record of skippedRecords) {
          skipRecords.push({
            cin7Id: record.cin7Id ?? `page-${page}-missing-id`,
            label: record.label,
            reason: record.reason,
          });
        }

        const nextPage = page + 1;
        nextFetch =
          nextPage <= MAX_PAGES
            ? (pageGapMs > 0
                ? new Promise((resolve) => setTimeout(resolve, pageGapMs)).then(() =>
                    fetchOmniContactsPage(omniCreds, nextPage, pageSize, { whereType: contactType })
                  )
                : fetchOmniContactsPage(omniCreds, nextPage, pageSize, { whereType: contactType }))
            : Promise.resolve({
                rows: [],
                total: null,
                sourceRowCount: 0,
                skippedWrongType: 0,
                skippedMissingId: 0,
                skippedRecords: [],
              });

        recordsProcessed += await batchUpsertCustomers(scope.userId, mapOmniCustomerRows(rows));
        if (sourceRowCount < pageSize) break;
        if (page >= MAX_PAGES) break;
      }
    } else if (entityType === 'internal-customers') {
      return NextResponse.json(
        { detail: 'Internal customer sync requires Cin7 Omni.' },
        { status: 400 }
      );
    }
  } else if (entityType === 'branches' || entityType === 'warehouses') {
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
        if (sourceRowCount < pageSize) break;
        if (page >= MAX_PAGES) break;
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
        whereType: 'Supplier',
      });

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { rows, sourceRowCount, skippedMissingId, skippedWrongType, skippedRecords } =
          await nextFetch;
        if (sourceRowCount === 0) break;

        skipped.missing_cin7_id += skippedMissingId;
        skipped.wrong_contact_type += skippedWrongType;
        for (const record of skippedRecords) {
          skipRecords.push({
            cin7Id: record.cin7Id ?? `page-${page}-missing-id`,
            label: record.label,
            reason: record.reason,
          });
        }

        const nextPage = page + 1;
        nextFetch =
          nextPage <= MAX_PAGES
            ? (pageGapMs > 0
                ? new Promise((resolve) => setTimeout(resolve, pageGapMs)).then(() =>
                    fetchOmniContactsPage(omniCreds, nextPage, pageSize, { whereType: 'Supplier' })
                  )
                : fetchOmniContactsPage(omniCreds, nextPage, pageSize, { whereType: 'Supplier' }))
            : Promise.resolve({
                rows: [],
                total: null,
                sourceRowCount: 0,
                skippedWrongType: 0,
                skippedMissingId: 0,
                skippedRecords: [],
              });

        recordsProcessed += await batchUpsertSuppliers(scope.userId, mapOmniSupplierRows(rows));
        if (sourceRowCount < pageSize) break;
        if (page >= MAX_PAGES) break;
      }
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
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { rows, sourceRowCount } = await fetchOmniProductCategoriesPage(
        omniCreds,
        page,
        pageSize
      );
      if (sourceRowCount === 0) break;
      recordsProcessed += await batchUpsertProductCategories(scope.userId, rows);
      if (sourceRowCount < pageSize) break;
      if (page >= MAX_PAGES) break;
    }
  } else if (entityType === 'brands') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json({ detail: 'Brand sync requires Cin7 Omni.' }, { status: 400 });
    }
    const raw = await fetchFullOmniProductsRawCatalog(omniCreds);
    const { brands } = extractReferenceDataFromProducts(raw.styles);
    recordsProcessed = await batchUpsertBrands(scope.userId, brands);
  } else if (entityType === 'price-lists') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json({ detail: 'Price list sync requires Cin7 Omni.' }, { status: 400 });
    }
    const derived = await fetchDerivedReferenceCatalog(omniCreds);
    recordsProcessed = await batchUpsertPriceLists(
      scope.userId,
      mapPriceColumnLabels(derived.priceColumns)
    );
  } else if (entityType === 'tax-codes') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json({ detail: 'Tax code sync requires Cin7 Omni.' }, { status: 400 });
    }
    const derived = await fetchDerivedReferenceCatalog(omniCreds);
    recordsProcessed = await batchUpsertTaxCodes(scope.userId, derived.taxCodes);
  } else if (entityType === 'units-of-measure') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json({ detail: 'Unit of measure sync requires Cin7 Omni.' }, { status: 400 });
    }
    const raw = await fetchFullOmniProductsRawCatalog(omniCreds);
    const { unitsOfMeasure } = extractReferenceDataFromProducts(raw.styles);
    recordsProcessed = await batchUpsertUnitsOfMeasure(scope.userId, unitsOfMeasure);
  } else if (entityType === 'stock-levels') {
    if (!useOmni || !omniCreds) {
      return NextResponse.json({ detail: 'Stock level sync requires Cin7 Omni (/v1/Stock).' }, { status: 400 });
    }
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { rows, sourceRowCount } = await fetchOmniStockPage(omniCreds, page, pageSize);
      if (sourceRowCount === 0) break;
      recordsProcessed += await batchUpsertStockLevels(
        scope.userId,
        mapOmniStockLevelRows(rows)
      );
      if (sourceRowCount < pageSize) break;
      if (page >= MAX_PAGES) break;
    }
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
