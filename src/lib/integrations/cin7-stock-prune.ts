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
  missing_keys: string[];
  errors: string[];
  dry_run: boolean;
  freeze_id?: string;
};

export function stockKey(branchId: string, sku: string): string {
  return `${branchId}:${sku}`;
}

export function diffStockKeysForPrune(
  cin7Keys: Set<string>,
  optix: Array<{ id: string; cin7BranchId: string; sku: string }>
): {
  toDeleteIds: string[];
  missing_in_optix: number;
  missing_keys: string[];
  optix_before: number;
  cin7_keys: number;
} {
  const toDeleteIds: string[] = [];
  const optixKeys = new Set<string>();
  for (const row of optix) {
    const key = stockKey(row.cin7BranchId, row.sku);
    optixKeys.add(key);
    if (!cin7Keys.has(key)) toDeleteIds.push(row.id);
  }
  const missing_keys: string[] = [];
  for (const key of cin7Keys) {
    if (!optixKeys.has(key)) missing_keys.push(key);
  }
  missing_keys.sort();
  return {
    toDeleteIds,
    missing_in_optix: missing_keys.length,
    missing_keys,
    optix_before: optix.length,
    cin7_keys: cin7Keys.size,
  };
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
 * Delete Optix stock rows whose (branch, sku) is absent from a frozen Cin7 keyset.
 * Does not re-walk live Cin7. Qty heal is a separate field-heal action.
 */
export async function pruneOptixStockLevelsToKeyset(
  ownerUserId: string,
  cin7Keys: Set<string>,
  options?: { dryRun?: boolean; freezeId?: string }
): Promise<Cin7StockPruneResult> {
  const dryRun = options?.dryRun === true;
  const optixRows = await prisma.cin7StockLevel.findMany({
    where: { ownerUserId },
    select: { id: true, cin7BranchId: true, sku: true },
  });
  const diff = diffStockKeysForPrune(cin7Keys, optixRows);

  let deleted = 0;
  if (!dryRun && diff.toDeleteIds.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < diff.toDeleteIds.length; i += batchSize) {
      const chunk = diff.toDeleteIds.slice(i, i + batchSize);
      const result = await prisma.cin7StockLevel.deleteMany({
        where: { ownerUserId, id: { in: chunk } },
      });
      deleted += result.count;
    }
  } else if (dryRun) {
    deleted = diff.toDeleteIds.length;
  }

  console.log(
    `[Cin7 stock prune] owner=${ownerUserId} freeze=${options?.freezeId ?? 'none'} ` +
      `cin7=${diff.cin7_keys} optix=${diff.optix_before} delete=${deleted} ` +
      `missing=${diff.missing_in_optix} dryRun=${dryRun}`
  );

  return {
    cin7_keys: diff.cin7_keys,
    optix_before: diff.optix_before,
    deleted,
    missing_in_optix: diff.missing_in_optix,
    missing_keys: diff.missing_keys,
    errors: [],
    dry_run: dryRun,
    freeze_id: options?.freezeId,
  };
}

/**
 * Full Omni /v1/Stock walk → delete Optix cin7_stock_levels whose (branch, sku) is absent.
 * Prefer pruneOptixStockLevelsToKeyset against a D10 freeze for sign-off.
 */
export async function pruneOptixStockLevelsToCin7(
  ownerUserId: string,
  omniCreds: Cin7OmniCredentials,
  options?: { dryRun?: boolean }
): Promise<Cin7StockPruneResult> {
  const catalog = await fetchFullOmniStockCatalog(omniCreds);
  if (catalog.errors.length > 0 && catalog.stockLevels.length === 0) {
    return {
      cin7_keys: 0,
      optix_before: 0,
      deleted: 0,
      missing_in_optix: 0,
      missing_keys: [],
      errors: catalog.errors,
      dry_run: options?.dryRun === true,
    };
  }

  const cin7ByKey = dedupeOmniStockLevels(catalog.stockLevels);
  const result = await pruneOptixStockLevelsToKeyset(ownerUserId, new Set(cin7ByKey.keys()), {
    dryRun: options?.dryRun,
  });
  if (!options?.dryRun && catalog.errors.length === 0) {
    await healOptixStockFieldMismatches(ownerUserId, catalog.stockLevels);
  }
  return { ...result, errors: catalog.errors.slice(0, 20) };
}
