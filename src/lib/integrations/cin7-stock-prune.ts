/**
 * Cin7 Omni is source of truth for stock levels.
 * After a verified full catalog walk, remove Optix rows that no longer exist in Cin7
 * (phantom inventory). Never prune on incremental / incomplete pulls.
 */

import { prisma } from '@/lib/db/prisma';
import { fetchFullOmniStockCatalog } from '@/lib/integrations/cin7-catalog-fetch';
import {
  dedupeOmniStockLevels,
  normalizeOmniStockQty,
  type Cin7OmniCredentials,
  type Cin7OmniStockLevelRow,
} from '@/lib/integrations/cin7-omni';
import {
  batchUpsertStockLevels,
  mapOmniStockLevelRows,
} from '@/lib/integrations/cin7-sync-persist';

export type Cin7StockPruneResult = {
  cin7_keys: number;
  optix_before: number;
  deleted: number;
  missing_in_optix: number;
  errors: string[];
  dry_run: boolean;
};

function stockKey(branchId: string, sku: string): string {
  return `${branchId}:${sku}`;
}

/**
 * Push live Cin7 qtys onto Optix for keys that already exist but differ
 * (available / stockOnHand / incoming). Clears residual "field diffs" after
 * a prune that only removed extras, or after Cin7 moved stock post-sync.
 */
export async function healOptixStockFieldMismatches(
  ownerUserId: string,
  cin7Rows: Cin7OmniStockLevelRow[]
): Promise<{ healed: number; checked: number }> {
  const cin7ByKey = dedupeOmniStockLevels(cin7Rows);
  if (cin7ByKey.size === 0) return { healed: 0, checked: 0 };

  const optixRows = await prisma.cin7StockLevel.findMany({
    where: { ownerUserId },
    select: {
      cin7BranchId: true,
      sku: true,
      available: true,
      stockOnHand: true,
      incoming: true,
    },
  });

  const toHeal: Cin7OmniStockLevelRow[] = [];
  for (const row of optixRows) {
    const key = stockKey(row.cin7BranchId, row.sku);
    const cin7 = cin7ByKey.get(key);
    if (!cin7) continue;
    if (
      normalizeOmniStockQty(row.available) !== cin7.available ||
      normalizeOmniStockQty(row.stockOnHand) !== cin7.stockOnHand ||
      normalizeOmniStockQty(row.incoming) !== cin7.incoming
    ) {
      toHeal.push(cin7);
    }
  }

  if (toHeal.length === 0) return { healed: 0, checked: optixRows.length };

  await batchUpsertStockLevels(ownerUserId, mapOmniStockLevelRows(toHeal));
  console.log(
    `[Cin7 stock heal] owner=${ownerUserId} healed=${toHeal.length} checked=${optixRows.length}`
  );
  return { healed: toHeal.length, checked: optixRows.length };
}

/**
 * Full Omni /v1/Stock walk → delete Optix cin7_stock_levels whose (branch, sku) is absent.
 * Also heals qty field mismatches so prune leaves a clean exception summary.
 */
export async function pruneOptixStockLevelsToCin7(
  ownerUserId: string,
  omniCreds: Cin7OmniCredentials,
  options?: { dryRun?: boolean }
): Promise<Cin7StockPruneResult> {
  const dryRun = options?.dryRun === true;
  const catalog = await fetchFullOmniStockCatalog(omniCreds);
  if (catalog.errors.length > 0 && catalog.stockLevels.length === 0) {
    return {
      cin7_keys: 0,
      optix_before: 0,
      deleted: 0,
      missing_in_optix: 0,
      errors: catalog.errors,
      dry_run: dryRun,
    };
  }

  const cin7ByKey = dedupeOmniStockLevels(catalog.stockLevels);
  const cin7Keys = new Set(cin7ByKey.keys());

  const optixRows = await prisma.cin7StockLevel.findMany({
    where: { ownerUserId },
    select: { id: true, cin7BranchId: true, sku: true },
  });

  const toDeleteIds: string[] = [];
  const optixKeys = new Set<string>();
  for (const row of optixRows) {
    const key = stockKey(row.cin7BranchId, row.sku);
    optixKeys.add(key);
    if (!cin7Keys.has(key)) toDeleteIds.push(row.id);
  }

  let missingInOptix = 0;
  for (const key of cin7Keys) {
    if (!optixKeys.has(key)) missingInOptix += 1;
  }

  let deleted = 0;
  if (!dryRun && toDeleteIds.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < toDeleteIds.length; i += batchSize) {
      const chunk = toDeleteIds.slice(i, i + batchSize);
      const result = await prisma.cin7StockLevel.deleteMany({
        where: { ownerUserId, id: { in: chunk } },
      });
      deleted += result.count;
    }
  } else if (dryRun) {
    deleted = toDeleteIds.length;
  }

  if (!dryRun) {
    await healOptixStockFieldMismatches(ownerUserId, catalog.stockLevels);
  }

  console.log(
    `[Cin7 stock prune] owner=${ownerUserId} cin7=${cin7Keys.size} optix=${optixRows.length} ` +
      `delete=${deleted} missing=${missingInOptix} dryRun=${dryRun} errors=${catalog.errors.length}`
  );

  return {
    cin7_keys: cin7Keys.size,
    optix_before: optixRows.length,
    deleted,
    missing_in_optix: missingInOptix,
    errors: catalog.errors.slice(0, 20),
    dry_run: dryRun,
  };
}
