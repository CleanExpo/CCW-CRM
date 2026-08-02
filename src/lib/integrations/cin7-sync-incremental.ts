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
 */
export function decideCin7SyncMode(input: {
  forceFull: boolean;
  forceRestart: boolean;
  status: string;
  completedAt: Date | null | undefined;
}): { mode: Cin7SyncMode; modifiedSince: Date | null } {
  if (input.status === 'incomplete' || input.status === 'running') {
    return { mode: 'resume', modifiedSince: null };
  }
  if (input.forceFull) {
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

/** Entities that support Omni `modifieddate>=` filters for incremental pulls. */
export function entitySupportsModifiedSince(entityType: string): boolean {
  const resolved = resolveCin7SyncEntityAlias(entityType);
  return (
    resolved === 'products' ||
    resolved === 'customers' ||
    resolved === 'internal-customers' ||
    resolved === 'suppliers' ||
    resolved === 'brands' ||
    resolved === 'price-lists' ||
    resolved === 'units-of-measure' ||
    resolved === 'stock-levels'
  );
}
