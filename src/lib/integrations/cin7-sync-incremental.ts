/**
 * Additive / incremental Cin7 sync helpers.
 *
 * Guarantees:
 * - Optix row counts never decrease because of a sync (upsert-only; no table wipes).
 * - Reported `records_processed` is floored at the live Optix count.
 * - Re-sync after a successful complete uses ModifiedDate when possible (deltas only).
 * - Deletions are never inferred from a partial/incremental pull.
 */

import { prisma } from '@/lib/db/prisma';
import { resolveCin7SyncEntityAlias } from '@/lib/integrations/cin7-master-entities';

const CIN7_PRODUCT_CATEGORY_PREFIX = 'Cin7';

/** Overlap window so borderline ModifiedDate rows are not missed. */
export const CIN7_INCREMENTAL_OVERLAP_MS = 24 * 60 * 60 * 1000;

export type Cin7SyncMode = 'full' | 'incremental' | 'resume';

export function buildCin7ModifiedSinceWhere(since: Date): string {
  // Cin7 Omni docs: where=modifieddate>='2020-12-31T00:00:00Z'
  const iso = since.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `modifieddate>='${iso}'`;
}

export function resolveIncrementalWatermark(completedAt: Date | null | undefined): Date | null {
  if (!completedAt) return null;
  return new Date(completedAt.getTime() - CIN7_INCREMENTAL_OVERLAP_MS);
}

/**
 * Decide sync mode for this request.
 * - incomplete/running → resume checkpoint
 * - complete + not full → incremental (ModifiedDate), never wipe Optix
 * - failed/idle/never/full → full page scan (still upsert-only)
 * - complete but Optix still short of a known Cin7 total → full (backfill gap)
 */
export function decideCin7SyncMode(input: {
  forceFull: boolean;
  forceRestart: boolean;
  status: string;
  completedAt: Date | null | undefined;
  /** Live Optix rows for this entity (when available). */
  optixCount?: number;
  /** Last known Cin7 total (e.g. from recon cache). */
  expectedSourceCount?: number | null;
  /** Tolerate small timing drift between recon and sync. */
  shortfallTolerance?: number;
}): { mode: Cin7SyncMode; modifiedSince: Date | null } {
  if (input.status === 'incomplete' || input.status === 'running') {
    return { mode: 'resume', modifiedSince: null };
  }
  if (input.forceFull) {
    return { mode: 'full', modifiedSince: null };
  }
  const tolerance = input.shortfallTolerance ?? 5;
  const expected = input.expectedSourceCount;
  const optix = input.optixCount;
  if (
    typeof expected === 'number' &&
    expected > 0 &&
    typeof optix === 'number' &&
    optix + tolerance < expected
  ) {
    // Prior "complete" left a recon gap — ModifiedDate deltas will never backfill missing IDs.
    return { mode: 'full', modifiedSince: null };
  }
  // Re-running a completed entity: prefer incremental unless explicitly full.
  if (input.status === 'complete') {
    const modifiedSince = resolveIncrementalWatermark(input.completedAt);
    if (modifiedSince) {
      return { mode: 'incremental', modifiedSince };
    }
  }
  return { mode: 'full', modifiedSince: null };
}

/** Map sync entity → Cin7 count on a live recon snapshot (null when N/A). */
export function expectedCin7CountFromRecon(
  entityType: string,
  snapshot:
    | {
        cin7: {
          customers: number;
          internal_customers: number;
          suppliers: number;
          products: { skus: number };
          branches: number;
          reference: {
            brands: number;
            price_lists: number;
            tax_codes: number;
            units_of_measure: number;
            stock_levels: number;
            product_categories: number;
          } | null;
        };
      }
    | null
    | undefined
): number | null {
  if (!snapshot) return null;
  const resolved = resolveCin7SyncEntityAlias(entityType);
  switch (resolved) {
    case 'customers':
      return snapshot.cin7.customers;
    case 'internal-customers':
      return snapshot.cin7.internal_customers;
    case 'suppliers':
      return snapshot.cin7.suppliers;
    case 'products':
      return snapshot.cin7.products.skus;
    case 'branches':
      return snapshot.cin7.branches;
    case 'brands':
      return snapshot.cin7.reference?.brands ?? null;
    case 'price-lists':
      return snapshot.cin7.reference?.price_lists ?? null;
    case 'tax-codes':
      return snapshot.cin7.reference?.tax_codes ?? null;
    case 'units-of-measure':
      return snapshot.cin7.reference?.units_of_measure ?? null;
    case 'stock-levels':
      return snapshot.cin7.reference?.stock_levels ?? null;
    case 'product-categories':
      return snapshot.cin7.reference?.product_categories ?? null;
    default:
      return null;
  }
}

/** Live Optix row count for the sync entity (authoritative for UI). */
export async function getOptixEntityRecordCount(
  ownerUserId: string,
  entityType: string
): Promise<number> {
  const resolved = resolveCin7SyncEntityAlias(entityType);

  switch (resolved) {
    case 'products':
      return prisma.product.count({
        where: { ownerUserId, category: { startsWith: CIN7_PRODUCT_CATEGORY_PREFIX } },
      });
    case 'customers':
      return prisma.customer.count({
        where: {
          ownerUserId,
          cin7ContactId: { not: null },
          OR: [
            { cin7ContactType: { equals: 'Customer', mode: 'insensitive' } },
            { cin7ContactType: null },
          ],
        },
      });
    case 'internal-customers':
      return prisma.customer.count({
        where: {
          ownerUserId,
          cin7ContactType: { equals: 'Internal', mode: 'insensitive' },
        },
      });
    case 'suppliers':
      return prisma.supplier.count({
        where: { ownerUserId, supplierCode: { startsWith: 'cin7:' } },
      });
    case 'branches':
      return prisma.cin7Branch.count({ where: { ownerUserId } });
    case 'product-categories':
      return prisma.cin7ProductCategory.count({ where: { ownerUserId } });
    case 'brands':
      return prisma.cin7Brand.count({ where: { ownerUserId } });
    case 'price-lists':
      return prisma.cin7PriceList.count({ where: { ownerUserId } });
    case 'tax-codes':
      return prisma.cin7TaxCode.count({ where: { ownerUserId } });
    case 'units-of-measure':
      return prisma.cin7UnitOfMeasure.count({ where: { ownerUserId } });
    case 'stock-levels':
      return prisma.cin7StockLevel.count({ where: { ownerUserId } });
    case 'orders':
      // Orders are count-only (no Optix rows); keep prior sync counter externally.
      return 0;
    default:
      return 0;
  }
}

/**
 * Floored record count for sync history / checkpoints.
 * Never report below current Optix rows (or a previous floor).
 */
export function floorSyncRecordCount(input: {
  optixCount: number;
  thisRunProcessed: number;
  previousFloor?: number;
}): number {
  return Math.max(0, input.optixCount, input.thisRunProcessed, input.previousFloor ?? 0);
}

/**
 * Entities that support Omni `modifieddate>=` filters for incremental pulls.
 * Contact entities are excluded: a prior short "complete" + ModifiedDate deltas
 * never backfills IDs that were never imported (recon gap stuck forever).
 */
export function entitySupportsModifiedSince(entityType: string): boolean {
  const resolved = resolveCin7SyncEntityAlias(entityType);
  return (
    resolved === 'products' ||
    resolved === 'brands' ||
    resolved === 'price-lists' ||
    resolved === 'units-of-measure' ||
    resolved === 'stock-levels'
  );
}
