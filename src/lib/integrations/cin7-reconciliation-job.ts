/**
 * Fail-closed, DB-backed Cin7 reconciliation acceptance gate.
 * Never reports clean zeros when sync or Cin7 snapshot is incomplete.
 */

import { prisma } from '@/lib/db/prisma';
import {
  fetchAllOmniMasterCatalogsSequential,
  getReconCatalogFetchOptions,
  resolveCin7SyncSource,
} from '@/lib/integrations/cin7-catalog-fetch';
import { getCin7CoreCredentials, pingCin7Core } from '@/lib/integrations/cin7-core';
import { CIN7_MASTER_ENTITY_TYPES } from '@/lib/integrations/cin7-master-entities';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';
import type {
  Cin7ExceptionEntity,
  Cin7ExceptionRecord,
  Cin7ReconciliationSnapshot,
} from '@/lib/integrations/cin7-reconciliation';
import {
  getCin7ReferenceCounts,
  getOptixReferenceCounts,
  type Cin7ReferenceCounts,
} from '@/lib/integrations/cin7-reconciliation-reference';
import { Prisma } from '@prisma/client';

/** Entities that must have Cin7SyncRun.status === 'complete' before acceptance. */
export const CIN7_RECON_GATE_ENTITIES = [
  'products',
  'customers',
  'internal-customers',
  'suppliers',
  'branches',
  'product-categories',
  'brands',
  'price-lists',
  'tax-codes',
  'units-of-measure',
  'stock-levels',
  'orders',
] as const;

export type Cin7ReconRunStatus = 'blocked' | 'running' | 'complete' | 'failed';

export type Cin7DbReconView = Cin7ReconciliationSnapshot & {
  recon_status: Cin7ReconRunStatus;
  blocked_reason: string | null;
  recon_run_id: string | null;
  incomplete_sync: boolean;
  cin7_snapshot_complete: boolean;
  optix_complete: boolean;
};

function emptyReference(): Cin7ReferenceCounts {
  return {
    product_categories: 0,
    brands: 0,
    price_lists: 0,
    tax_codes: 0,
    units_of_measure: 0,
    stock_levels: 0,
    warehouses: 0,
  };
}

function emptyExceptionsSummary(): Cin7ReconciliationSnapshot['exceptions_summary'] {
  return {
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
  };
}

export async function getIncompleteSyncEntities(ownerUserId: string): Promise<string[]> {
  const runs = await prisma.cin7SyncRun.findMany({
    where: {
      ownerUserId,
      entityType: { in: [...CIN7_RECON_GATE_ENTITIES] },
    },
    select: { entityType: true, status: true },
  });
  const byType = new Map(runs.map((r) => [r.entityType, r.status]));
  return CIN7_RECON_GATE_ENTITIES.filter((entity) => byType.get(entity) !== 'complete');
}

async function loadOptixCounts(ownerUserId: string) {
  const [
    productRows,
    customerLinked,
    customerTotal,
    customerExtraWithoutId,
    internalCount,
    supplierLinked,
    supplierTotal,
    branchTotal,
    reference,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { ownerUserId, category: { startsWith: 'Cin7' } },
      select: {
        sku: true,
        cin7StyleCode: true,
        cin7Visibility: true,
        isActive: true,
      },
    }),
    prisma.customer.count({
      where: {
        ownerUserId,
        cin7ContactId: { not: null },
        OR: [
          { cin7ContactType: { equals: 'Customer', mode: 'insensitive' } },
          { cin7ContactType: null },
        ],
      },
    }),
    prisma.customer.count({ where: { ownerUserId } }),
    prisma.customer.count({
      where: {
        ownerUserId,
        cin7ContactId: null,
        OR: [
          { cin7ContactType: { equals: 'Customer', mode: 'insensitive' } },
          { cin7ContactType: null },
        ],
      },
    }),
    prisma.customer.count({
      where: {
        ownerUserId,
        cin7ContactType: { equals: 'Internal', mode: 'insensitive' },
      },
    }),
    // Suppliers store Cin7 ids as supplierCode `cin7:<contactId>` (no cin7ContactId column).
    prisma.supplier.count({
      where: { ownerUserId, supplierCode: { startsWith: 'cin7:' } },
    }),
    prisma.supplier.count({ where: { ownerUserId } }),
    prisma.cin7Branch.count({ where: { ownerUserId } }),
    getOptixReferenceCounts(ownerUserId),
  ]);

  const styleCodes = new Set(
    productRows.map((p) => p.cin7StyleCode).filter((v): v is string => Boolean(v))
  );
  const byVisibility: Record<string, number> = {};
  for (const p of productRows) {
    const key = p.cin7Visibility || (p.isActive ? 'Active' : 'Inactive');
    byVisibility[key] = (byVisibility[key] ?? 0) + 1;
  }

  return {
    products: {
      total_cin7_sourced: productRows.length,
      skus: productRows.length,
      styles: styleCodes.size,
      by_visibility: byVisibility,
    },
    customers: {
      total: customerTotal,
      cin7_linked: customerLinked,
      extra_without_cin7_id: customerExtraWithoutId,
    },
    internal_customers: internalCount,
    suppliers: {
      total: supplierTotal,
      cin7_linked: supplierLinked,
      extra_without_cin7_id: Math.max(0, supplierTotal - supplierLinked),
    },
    branches: { total: branchTotal },
    reference,
  };
}

function snapshotPayloadFromCatalog(
  entityType: string,
  catalogs: Awaited<ReturnType<typeof fetchAllOmniMasterCatalogsSequential>>
): { count: number; payload: unknown[]; complete: boolean; errors: string[] } {
  switch (entityType) {
    case 'products': {
      const errors = catalogs.products.errors;
      const payload = catalogs.products.skus.map((s) => ({
        id: s.sku,
        label: s.name,
        fields: { visibility: s.visibility, price: s.price, stock: s.stock },
      }));
      return {
        count: catalogs.products.skus.length,
        payload,
        complete: errors.length === 0,
        errors,
      };
    }
    case 'customers': {
      const errors = catalogs.customers.errors;
      const payload = catalogs.customers.contacts.map((c) => ({
        id: c.cin7ContactId,
        label: c.companyName,
      }));
      return {
        count: payload.length,
        payload,
        complete: errors.length === 0,
        errors,
      };
    }
    case 'internal-customers': {
      const errors = catalogs.internalCustomers.errors;
      const payload = catalogs.internalCustomers.contacts.map((c) => ({
        id: c.cin7ContactId,
        label: c.companyName,
      }));
      return {
        count: payload.length,
        payload,
        complete: errors.length === 0,
        errors,
      };
    }
    case 'suppliers': {
      const errors = catalogs.suppliers.errors;
      const payload = catalogs.suppliers.contacts.map((c) => ({
        id: c.cin7ContactId,
        label: c.companyName,
      }));
      return {
        count: payload.length,
        payload,
        complete: errors.length === 0,
        errors,
      };
    }
    case 'branches':
    case 'warehouses': {
      const errors = catalogs.branches.errors;
      const payload = catalogs.branches.branches.map((b) => ({
        id: b.cin7BranchId,
        label: b.name,
      }));
      return {
        count: payload.length,
        payload,
        complete: errors.length === 0,
        errors,
      };
    }
    case 'product-categories': {
      const errors = catalogs.productCategories.errors;
      const payload = catalogs.productCategories.categories.map((c) => ({
        id: c.cin7CategoryId,
        label: c.name,
      }));
      return {
        count: payload.length,
        payload,
        complete: errors.length === 0,
        errors,
      };
    }
    case 'brands': {
      const errors = [...catalogs.products.errors];
      const brands = catalogs.derived.brands;
      const payload = brands.map((name) => ({ id: name, label: name }));
      return { count: payload.length, payload, complete: errors.length === 0, errors };
    }
    case 'price-lists': {
      const errors = [...catalogs.products.errors];
      const cols = catalogs.derived.priceColumns;
      const payload = cols.map((c) => ({ id: c, label: c }));
      return { count: payload.length, payload, complete: errors.length === 0, errors };
    }
    case 'tax-codes': {
      const errors = [...catalogs.customers.errors, ...catalogs.branches.errors];
      const codes = catalogs.derived.taxCodes;
      const payload = codes.map((c) => ({ id: c, label: c }));
      return { count: payload.length, payload, complete: errors.length === 0, errors };
    }
    case 'units-of-measure': {
      const errors = [...catalogs.products.errors];
      const uoms = catalogs.derived.unitsOfMeasure;
      const payload = uoms.map((c) => ({ id: c, label: c }));
      return { count: payload.length, payload, complete: errors.length === 0, errors };
    }
    case 'stock-levels': {
      const errors = catalogs.stockLevels.errors;
      const levels = catalogs.stockLevels.stockLevels;
      const payload = levels.map((s) => ({
        id: `${s.cin7BranchId}:${s.sku}`,
        label: s.sku,
      }));
      return { count: payload.length, payload, complete: errors.length === 0, errors };
    }
    default:
      return { count: 0, payload: [], complete: false, errors: [`Unknown entity ${entityType}`] };
  }
}

async function compareSnapshotToOptix(
  ownerUserId: string,
  entityType: string,
  cin7Ids: Set<string>
): Promise<Cin7ExceptionRecord[]> {
  const exceptions: Cin7ExceptionRecord[] = [];

  if (entityType === 'products') {
    const optix = await prisma.product.findMany({
      where: { ownerUserId, category: { startsWith: 'Cin7' } },
      select: { sku: true, name: true },
    });
    const optixIds = new Set(optix.map((p) => p.sku));
    for (const id of cin7Ids) {
      if (!optixIds.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!cin7Ids.has(row.sku)) {
        exceptions.push({
          cin7_id: row.sku,
          label: row.name,
          reason: 'extra_in_optix',
        });
      }
    }
    return exceptions;
  }

  if (
    entityType === 'customers' ||
    entityType === 'internal-customers' ||
    entityType === 'suppliers'
  ) {
    const contactType =
      entityType === 'internal-customers'
        ? 'Internal'
        : entityType === 'suppliers'
          ? null
          : 'Customer';

    if (entityType === 'suppliers') {
      const optix = await prisma.supplier.findMany({
        where: { ownerUserId, supplierCode: { startsWith: 'cin7:' } },
        select: { supplierCode: true, companyName: true },
      });
      const optixIds = new Set(
        optix.map((r) => r.supplierCode.replace(/^cin7:/, '')).filter(Boolean)
      );
      for (const id of cin7Ids) {
        if (!optixIds.has(id)) {
          exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
        }
      }
      for (const row of optix) {
        const id = row.supplierCode.replace(/^cin7:/, '');
        if (id && !cin7Ids.has(id)) {
          exceptions.push({
            cin7_id: id,
            label: row.companyName,
            reason: 'extra_in_optix',
          });
        }
      }
      return exceptions;
    }

    const optix = await prisma.customer.findMany({
      where: {
        ownerUserId,
        cin7ContactId: { not: null },
        ...(contactType
          ? {
              OR:
                contactType === 'Customer'
                  ? [
                      { cin7ContactType: { equals: 'Customer', mode: 'insensitive' as const } },
                      { cin7ContactType: null },
                    ]
                  : [{ cin7ContactType: { equals: contactType, mode: 'insensitive' as const } }],
            }
          : {}),
      },
      select: { cin7ContactId: true, companyName: true },
    });
    const optixIds = new Set(
      optix.map((r) => r.cin7ContactId).filter((v): v is string => Boolean(v))
    );
    for (const id of cin7Ids) {
      if (!optixIds.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (row.cin7ContactId && !cin7Ids.has(row.cin7ContactId)) {
        exceptions.push({
          cin7_id: row.cin7ContactId,
          label: row.companyName,
          reason: 'extra_in_optix',
        });
      }
    }
    return exceptions;
  }

  if (entityType === 'branches' || entityType === 'warehouses') {
    const optix = await prisma.cin7Branch.findMany({
      where: { ownerUserId },
      select: { cin7BranchId: true, name: true },
    });
    const optixIds = new Set(optix.map((b) => b.cin7BranchId));
    for (const id of cin7Ids) {
      if (!optixIds.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!cin7Ids.has(row.cin7BranchId)) {
        exceptions.push({
          cin7_id: row.cin7BranchId,
          label: row.name,
          reason: 'extra_in_optix',
        });
      }
    }
    return exceptions;
  }

  // Reference entities — id is the natural key (name/code)
  if (entityType === 'brands') {
    const optix = await prisma.cin7Brand.findMany({
      where: { ownerUserId },
      select: { name: true },
    });
    const optixIds = new Set(optix.map((r) => r.name));
    for (const id of cin7Ids) {
      if (!optixIds.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!cin7Ids.has(row.name)) {
        exceptions.push({ cin7_id: row.name, label: row.name, reason: 'extra_in_optix' });
      }
    }
  } else if (entityType === 'price-lists') {
    const optix = await prisma.cin7PriceList.findMany({
      where: { ownerUserId },
      select: { cin7PriceColumn: true, name: true },
    });
    const optixIds = new Set(optix.map((r) => r.cin7PriceColumn));
    for (const id of cin7Ids) {
      if (!optixIds.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!cin7Ids.has(row.cin7PriceColumn)) {
        exceptions.push({
          cin7_id: row.cin7PriceColumn,
          label: row.name,
          reason: 'extra_in_optix',
        });
      }
    }
  } else if (entityType === 'tax-codes') {
    const optix = await prisma.cin7TaxCode.findMany({
      where: { ownerUserId },
      select: { code: true },
    });
    const optixIds = new Set(optix.map((r) => r.code));
    for (const id of cin7Ids) {
      if (!optixIds.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!cin7Ids.has(row.code)) {
        exceptions.push({ cin7_id: row.code, label: row.code, reason: 'extra_in_optix' });
      }
    }
  } else if (entityType === 'units-of-measure') {
    const optix = await prisma.cin7UnitOfMeasure.findMany({
      where: { ownerUserId },
      select: { code: true },
    });
    const optixIds = new Set(optix.map((r) => r.code));
    for (const id of cin7Ids) {
      if (!optixIds.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!cin7Ids.has(row.code)) {
        exceptions.push({ cin7_id: row.code, label: row.code, reason: 'extra_in_optix' });
      }
    }
  } else if (entityType === 'product-categories') {
    const optix = await prisma.cin7ProductCategory.findMany({
      where: { ownerUserId },
      select: { cin7CategoryId: true, name: true },
    });
    const optixIds = new Set(optix.map((r) => r.cin7CategoryId));
    for (const id of cin7Ids) {
      if (!optixIds.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
      }
    }
    for (const row of optix) {
      if (!cin7Ids.has(row.cin7CategoryId)) {
        exceptions.push({
          cin7_id: row.cin7CategoryId,
          label: row.name,
          reason: 'extra_in_optix',
        });
      }
    }
  } else if (entityType === 'stock-levels') {
    const optix = await prisma.cin7StockLevel.findMany({
      where: { ownerUserId },
      select: { cin7BranchId: true, sku: true },
    });
    const optixIds = new Set(optix.map((r) => `${r.cin7BranchId}:${r.sku}`));
    for (const id of cin7Ids) {
      if (!optixIds.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'missing_in_optix' });
      }
    }
    for (const id of optixIds) {
      if (!cin7Ids.has(id)) {
        exceptions.push({ cin7_id: id, label: id, reason: 'extra_in_optix' });
      }
    }
  }

  return exceptions;
}

function summarizeExceptions(
  exceptions: Array<{ entityType: string; reason: string }>
): Cin7ReconciliationSnapshot['exceptions_summary'] {
  const summary = emptyExceptionsSummary();
  const bump = (key: keyof typeof summary) => {
    summary[key] += 1;
  };
  for (const ex of exceptions) {
    const missing = ex.reason === 'missing_in_optix';
    const extra = ex.reason === 'extra_in_optix';
    const mismatch = ex.reason === 'field_mismatch';
    switch (ex.entityType) {
      case 'products':
        if (missing) bump('products_missing_in_optix');
        else if (extra) bump('products_extra_in_optix');
        else if (mismatch) bump('products_field_mismatches');
        break;
      case 'customers':
        if (missing) bump('customers_missing_in_optix');
        else if (extra) bump('customers_extra_in_optix');
        else if (mismatch) bump('customers_field_mismatches');
        break;
      case 'suppliers':
        if (missing) bump('suppliers_missing_in_optix');
        else if (extra) bump('suppliers_extra_in_optix');
        else if (mismatch) bump('suppliers_field_mismatches');
        break;
      case 'branches':
      case 'warehouses':
        if (missing) bump('branches_missing_in_optix');
        else if (extra) bump('branches_extra_in_optix');
        else if (mismatch) bump('branches_field_mismatches');
        break;
      case 'internal-customers':
        if (missing) bump('internal_customers_missing_in_optix');
        else if (extra) bump('internal_customers_extra_in_optix');
        else if (mismatch) bump('internal_customers_field_mismatches');
        break;
      case 'product-categories':
        if (missing) bump('product_categories_missing_in_optix');
        else if (extra) bump('product_categories_extra_in_optix');
        break;
      case 'brands':
        if (missing) bump('brands_missing_in_optix');
        else if (extra) bump('brands_extra_in_optix');
        break;
      case 'price-lists':
        if (missing) bump('price_lists_missing_in_optix');
        else if (extra) bump('price_lists_extra_in_optix');
        break;
      case 'tax-codes':
        if (missing) bump('tax_codes_missing_in_optix');
        else if (extra) bump('tax_codes_extra_in_optix');
        break;
      case 'units-of-measure':
        if (missing) bump('units_of_measure_missing_in_optix');
        else if (extra) bump('units_of_measure_extra_in_optix');
        break;
      case 'stock-levels':
        if (missing) bump('stock_levels_missing_in_optix');
        else if (extra) bump('stock_levels_extra_in_optix');
        break;
      default:
        break;
    }
  }
  return summary;
}

function viewFromBlocked(input: {
  runId: string;
  reason: string;
  optix: Awaited<ReturnType<typeof loadOptixCounts>>;
  notes: string[];
}): Cin7DbReconView {
  const summary = emptyExceptionsSummary();
  // Non-zero sentinel — never all-zero when blocked. Optix counts are real SQL;
  // Cin7 side is intentionally -1 / unavailable so UI cannot show a false match.
  summary.products_missing_in_optix = 1;
  return {
    recon_status: 'blocked',
    blocked_reason: input.reason,
    recon_run_id: input.runId,
    incomplete_sync: true,
    cin7_snapshot_complete: false,
    optix_complete: true,
    source: 'none',
    checked_at: new Date().toISOString(),
    cin7: {
      products: { styles: -1, skus: -1, by_visibility: {} },
      customers: -1,
      internal_customers: -1,
      suppliers: -1,
      branches: -1,
      reference: emptyReference(),
    },
    optix: input.optix,
    exceptions_summary: summary,
    fetch_meta: { errors: [input.reason] },
    notes: [
      ...input.notes,
      'Optix column = SQL counts from Postgres. Cin7 column unavailable until sync+snapshot complete.',
      'Field differences are counted per mismatched field occurrence (one customer with 3 bad fields = 3).',
      'Legacy Optix customers without cin7ContactId are not auto-merged by email; they appear as extras until linked.',
    ],
  };
}

export async function getLatestDbReconciliation(
  ownerUserId: string
): Promise<Cin7DbReconView | null> {
  const run = await prisma.cin7ReconRun
    .findFirst({
      where: { ownerUserId },
      orderBy: { checkedAt: 'desc' },
      include: {
        snapshots: true,
      },
    })
    .catch(() => null);
  if (!run) return null;

  const optix = await loadOptixCounts(ownerUserId);
  const summary =
    (run.summary as Cin7ReconciliationSnapshot['exceptions_summary'] | null) ??
    emptyExceptionsSummary();

  const snapByEntity = new Map(run.snapshots.map((s) => [s.entityType, s]));
  const products = snapByEntity.get('products');
  const productPayload =
    (products?.payload as Array<{ id: string; fields?: { visibility?: string } }>) ?? [];
  const byVis: Record<string, number> = {};
  for (const p of productPayload) {
    const v = p.fields?.visibility ?? 'Unknown';
    byVis[v] = (byVis[v] ?? 0) + 1;
  }

  const cin7Ref = emptyReference();
  for (const entity of CIN7_MASTER_ENTITY_TYPES) {
    const snap = snapByEntity.get(entity);
    if (!snap) continue;
    switch (entity) {
      case 'product-categories':
        cin7Ref.product_categories = snap.recordCount;
        break;
      case 'brands':
        cin7Ref.brands = snap.recordCount;
        break;
      case 'price-lists':
        cin7Ref.price_lists = snap.recordCount;
        break;
      case 'tax-codes':
        cin7Ref.tax_codes = snap.recordCount;
        break;
      case 'units-of-measure':
        cin7Ref.units_of_measure = snap.recordCount;
        break;
      case 'stock-levels':
        cin7Ref.stock_levels = snap.recordCount;
        break;
      case 'warehouses':
        cin7Ref.warehouses = snap.recordCount;
        break;
      default:
        break;
    }
  }
  if (!snapByEntity.get('warehouses') && snapByEntity.get('branches')) {
    cin7Ref.warehouses = snapByEntity.get('branches')!.recordCount;
  }

  const notes: string[] = [];
  if (run.status === 'blocked') {
    notes.push(run.blockedReason ?? 'Reconciliation blocked.');
  }
  notes.push('Acceptance view reads Durable Cin7 snapshots + Optix SQL counts only.');

  return {
    recon_status: run.status as Cin7ReconRunStatus,
    blocked_reason: run.blockedReason,
    recon_run_id: run.id,
    incomplete_sync: !run.optixComplete || run.status === 'blocked',
    cin7_snapshot_complete: run.cin7Complete,
    optix_complete: run.optixComplete,
    source: run.cin7Complete ? 'omni' : 'none',
    checked_at: run.checkedAt.toISOString(),
    cin7: {
      products: {
        styles: 0,
        skus: products?.recordCount ?? 0,
        by_visibility: byVis,
      },
      customers: snapByEntity.get('customers')?.recordCount ?? 0,
      internal_customers: snapByEntity.get('internal-customers')?.recordCount ?? 0,
      suppliers: snapByEntity.get('suppliers')?.recordCount ?? 0,
      branches: snapByEntity.get('branches')?.recordCount ?? 0,
      reference: cin7Ref,
    },
    optix,
    exceptions_summary: summary,
    fetch_meta: {
      errors: run.blockedReason ? [run.blockedReason] : [],
    },
    notes,
  };
}

/**
 * Run fail-closed reconciliation. Writes Cin7ReconRun + snapshots + exceptions.
 */
export async function runFailClosedReconciliation(ownerUserId: string): Promise<Cin7DbReconView> {
  const optix = await loadOptixCounts(ownerUserId);
  const incomplete = await getIncompleteSyncEntities(ownerUserId);

  if (incomplete.length > 0) {
    const reason = `Sync incomplete for: ${incomplete.join(', ')}. Complete all Phase 1 entity syncs before reconciliation acceptance.`;
    const run = await prisma.cin7ReconRun.create({
      data: {
        ownerUserId,
        status: 'blocked',
        blockedReason: reason,
        optixComplete: true,
        cin7Complete: false,
        missingCount: 1,
        summary: {
          ...emptyExceptionsSummary(),
          products_missing_in_optix: 1,
          incomplete_sync: true,
          incomplete_entities: incomplete,
        },
        checkedAt: new Date(),
      },
    });
    await prisma.cin7ReconException.create({
      data: {
        reconRunId: run.id,
        ownerUserId,
        entityType: 'products',
        reason: 'missing_in_optix',
        cin7Id: 'SYNC_INCOMPLETE',
        label: reason,
        fieldDiffs: { incomplete_entities: incomplete },
      },
    });
    return viewFromBlocked({
      runId: run.id,
      reason,
      optix,
      notes: [reason, 'Fail-closed: refusal to show clean zero exceptions.'],
    });
  }

  const run = await prisma.cin7ReconRun.create({
    data: {
      ownerUserId,
      status: 'running',
      optixComplete: true,
      cin7Complete: false,
      checkedAt: new Date(),
    },
  });

  const coreCreds = getCin7CoreCredentials();
  const omniCreds = getCin7OmniCredentials();
  const coreLive = coreCreds ? await pingCin7Core(coreCreds) : false;
  const omniLive = omniCreds ? await pingCin7Omni(omniCreds) : false;
  const source = resolveCin7SyncSource(coreLive, omniLive);

  if (source !== 'omni' || !omniCreds) {
    const reason =
      'Cin7 Omni snapshot pull required for fail-closed reconciliation. Omni is not reachable.';
    await prisma.cin7ReconRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        blockedReason: reason,
        cin7Complete: false,
        missingCount: 1,
        summary: { ...emptyExceptionsSummary(), products_missing_in_optix: 1 },
      },
    });
    await prisma.cin7ReconException.create({
      data: {
        reconRunId: run.id,
        ownerUserId,
        entityType: 'products',
        reason: 'missing_in_optix',
        cin7Id: 'CIN7_SNAPSHOT_FAILED',
        label: reason,
      },
    });
    return {
      ...viewFromBlocked({ runId: run.id, reason, optix, notes: [reason] }),
      recon_status: 'failed',
    };
  }

  const catalogs = await fetchAllOmniMasterCatalogsSequential(
    omniCreds,
    getReconCatalogFetchOptions()
  );
  const snapshotEntities = [
    'products',
    'customers',
    'internal-customers',
    'suppliers',
    'branches',
    'product-categories',
    'brands',
    'price-lists',
    'tax-codes',
    'units-of-measure',
    'stock-levels',
  ] as const;

  let allSnapshotsComplete = true;
  const snapshotErrors: string[] = [];

  for (const entityType of snapshotEntities) {
    const built = snapshotPayloadFromCatalog(entityType, catalogs);
    if (!built.complete) {
      allSnapshotsComplete = false;
      snapshotErrors.push(...built.errors.map((e) => `${entityType}: ${e}`));
    }
    await prisma.cin7CatalogSnapshot.create({
      data: {
        reconRunId: run.id,
        ownerUserId,
        entityType,
        recordCount: built.count,
        payload: built.payload as Prisma.InputJsonValue,
        complete: built.complete,
      },
    });
  }

  if (!allSnapshotsComplete) {
    const reason = `Incomplete Cin7 catalog snapshot: ${snapshotErrors.slice(0, 5).join('; ')}`;
    await prisma.cin7ReconRun.update({
      where: { id: run.id },
      data: {
        status: 'failed',
        blockedReason: reason,
        cin7Complete: false,
        missingCount: 1,
        summary: {
          ...emptyExceptionsSummary(),
          products_missing_in_optix: 1,
          cin7_snapshot_incomplete: true,
        },
      },
    });
    await prisma.cin7ReconException.create({
      data: {
        reconRunId: run.id,
        ownerUserId,
        entityType: 'products',
        reason: 'missing_in_optix',
        cin7Id: 'CIN7_SNAPSHOT_INCOMPLETE',
        label: reason,
      },
    });
    return {
      ...viewFromBlocked({ runId: run.id, reason, optix, notes: [reason] }),
      recon_status: 'failed',
      cin7_snapshot_complete: false,
    };
  }

  // Compare Optix vs durable snapshots
  const allExceptions: Array<{
    entityType: string;
    record: Cin7ExceptionRecord;
  }> = [];

  const snaps = await prisma.cin7CatalogSnapshot.findMany({
    where: { reconRunId: run.id },
  });

  for (const snap of snaps) {
    const payload = snap.payload as Array<{ id: string; label?: string }>;
    const cin7Ids = new Set(payload.map((p) => p.id));
    const exceptions = await compareSnapshotToOptix(ownerUserId, snap.entityType, cin7Ids);
    for (const record of exceptions) {
      allExceptions.push({ entityType: snap.entityType, record });
    }
  }

  const exceptionRows = allExceptions.map((ex) => ({
    reconRunId: run.id,
    ownerUserId,
    entityType: ex.entityType,
    reason: ex.record.reason,
    cin7Id: ex.record.cin7_id,
    label: ex.record.label,
    fieldDiffs: ex.record.fields ?? undefined,
  }));

  const batchSize = 500;
  for (let i = 0; i < exceptionRows.length; i += batchSize) {
    await prisma.cin7ReconException.createMany({
      data: exceptionRows.slice(i, i + batchSize),
    });
  }

  const summary = summarizeExceptions(
    allExceptions.map((e) => ({ entityType: e.entityType, reason: e.record.reason }))
  );
  const missingCount = allExceptions.filter((e) => e.record.reason === 'missing_in_optix').length;
  const extraCount = allExceptions.filter((e) => e.record.reason === 'extra_in_optix').length;
  const fieldMismatchCount = allExceptions.filter(
    (e) => e.record.reason === 'field_mismatch'
  ).length;

  const productsSnap = snaps.find((s) => s.entityType === 'products');
  const cin7Ref = getCin7ReferenceCounts(catalogs);

  await prisma.cin7ReconRun.update({
    where: { id: run.id },
    data: {
      status: 'complete',
      cin7Complete: true,
      optixComplete: true,
      missingCount,
      extraCount,
      fieldMismatchCount,
      linkedCount: Math.max(0, (productsSnap?.recordCount ?? 0) - missingCount),
      summary,
      completedAt: new Date(),
      blockedReason: null,
    },
  });

  return {
    recon_status: 'complete',
    blocked_reason: null,
    recon_run_id: run.id,
    incomplete_sync: false,
    cin7_snapshot_complete: true,
    optix_complete: true,
    source: 'omni',
    checked_at: new Date().toISOString(),
    cin7: {
      products: {
        styles: catalogs.products.styles,
        skus: catalogs.products.skus.length,
        by_visibility: catalogs.products.by_visibility,
      },
      customers: catalogs.customers.contacts.length,
      internal_customers: catalogs.internalCustomers.contacts.length,
      suppliers: catalogs.suppliers.contacts.length,
      branches: catalogs.branches.branches.length,
      reference: cin7Ref,
    },
    optix,
    exceptions_summary: summary,
    fetch_meta: {
      products_pages: catalogs.products.pages_fetched,
      customers_pages: catalogs.customers.pages_fetched,
      suppliers_pages: catalogs.suppliers.pages_fetched,
      branches_pages: catalogs.branches.pages_fetched,
      errors: [],
    },
    notes: [
      'Fail-closed reconciliation complete: Cin7 durable snapshot vs Optix SQL.',
      'Inactive products and all visibility types are included.',
    ],
  };
}

export async function listDbReconExceptions(
  ownerUserId: string,
  entity: Cin7ExceptionEntity,
  limit: number,
  offset: number
): Promise<{ total: number; items: Cin7ExceptionRecord[] }> {
  const run = await prisma.cin7ReconRun.findFirst({
    where: { ownerUserId },
    orderBy: { checkedAt: 'desc' },
    select: { id: true },
  });
  if (!run) {
    return { total: 0, items: [] };
  }

  const entityType = entity === 'warehouses' ? 'branches' : entity;
  const where = { reconRunId: run.id, entityType };
  const [total, rows] = await Promise.all([
    prisma.cin7ReconException.count({ where }),
    prisma.cin7ReconException.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    }),
  ]);

  return {
    total,
    items: rows.map((row) => {
      const raw = row.fieldDiffs;
      const fields = Array.isArray(raw) ? (raw as Cin7ExceptionRecord['fields']) : undefined;
      return {
        cin7_id: row.cin7Id,
        label: row.label ?? row.cin7Id,
        reason: row.reason as Cin7ExceptionRecord['reason'],
        fields,
        skipped_reason:
          raw && !Array.isArray(raw) && typeof raw === 'object' ? JSON.stringify(raw) : undefined,
      };
    }),
  };
}
