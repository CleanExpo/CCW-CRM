import { prisma } from '@/lib/db/prisma';
import type { Cin7ReconciliationSnapshot } from '@/lib/integrations/cin7-reconciliation';

export type Cin7SyncCompletenessRow = {
  entity: string;
  label: string;
  cin7_count: number | null;
  last_sync_records: number | null;
  last_sync_at: string | null;
  last_sync_duration_ms: number | null;
  likely_incomplete: boolean;
  note?: string;
};

const ENTITY_LABELS: Record<string, string> = {
  products: 'Products (SKUs)',
  customers: 'Customers',
  'internal-customers': 'Internal customers',
  suppliers: 'Suppliers',
  branches: 'Branches',
  'product-categories': 'Product categories',
  brands: 'Brands',
  'price-lists': 'Price lists',
  'tax-codes': 'Tax codes',
  'units-of-measure': 'Units of measure',
  'stock-levels': 'Stock levels',
  warehouses: 'Warehouses',
};

/** Alias keys that write the same Optix table (raw entityType on Cin7SyncRun). */
const ENTITY_RUN_ALIASES: Record<string, string[]> = {
  branches: ['branches', 'warehouses'],
  'stock-levels': ['stock-levels', 'inventory'],
};

function cin7CountForEntity(snapshot: Cin7ReconciliationSnapshot, entity: string): number | null {
  switch (entity) {
    case 'products':
      return snapshot.cin7.products.skus;
    case 'customers':
      return snapshot.cin7.customers;
    case 'internal-customers':
      return snapshot.cin7.internal_customers;
    case 'suppliers':
      return snapshot.cin7.suppliers;
    case 'branches':
    case 'warehouses':
      return snapshot.cin7.branches;
    case 'product-categories':
      return snapshot.cin7.reference?.product_categories ?? null;
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
    default:
      return null;
  }
}

/** Prefer Optix DB counts — reflects multi-chunk auto-resume better than a single run row. */
function optixCountForEntity(snapshot: Cin7ReconciliationSnapshot, entity: string): number | null {
  switch (entity) {
    case 'products':
      return snapshot.optix.products.skus;
    case 'customers':
      return snapshot.optix.customers.cin7_linked;
    case 'internal-customers':
      return snapshot.optix.internal_customers;
    case 'suppliers':
      return snapshot.optix.suppliers.cin7_linked;
    case 'branches':
    case 'warehouses':
      return snapshot.optix.branches.total;
    case 'product-categories':
      return snapshot.optix.reference?.product_categories ?? null;
    case 'brands':
      return snapshot.optix.reference?.brands ?? null;
    case 'price-lists':
      return snapshot.optix.reference?.price_lists ?? null;
    case 'tax-codes':
      return snapshot.optix.reference?.tax_codes ?? null;
    case 'units-of-measure':
      return snapshot.optix.reference?.units_of_measure ?? null;
    case 'stock-levels':
      return snapshot.optix.reference?.stock_levels ?? null;
    default:
      return null;
  }
}

export async function getLatestCin7SyncRunsByEntity(
  ownerUserId: string,
  entityTypes: string[]
): Promise<Map<string, { recordsProcessed: number; createdAt: Date; durationMs: number }>> {
  const byEntity = new Map<
    string,
    { recordsProcessed: number; createdAt: Date; durationMs: number }
  >();

  // Per-entity latest — avoid global take() missing quieter entities.
  await Promise.all(
    entityTypes.map(async (entityType) => {
      const run = await prisma.cin7SyncRun.findFirst({
        where: { ownerUserId, entityType },
        orderBy: { createdAt: 'desc' },
        select: {
          entityType: true,
          recordsProcessed: true,
          createdAt: true,
          durationMs: true,
        },
      });
      if (run) {
        byEntity.set(entityType, {
          recordsProcessed: run.recordsProcessed,
          createdAt: run.createdAt,
          durationMs: run.durationMs,
        });
      }
    })
  );

  return byEntity;
}

function pickLatestRun(
  latestRuns: Map<string, { recordsProcessed: number; createdAt: Date; durationMs: number }>,
  entity: string
): { recordsProcessed: number; createdAt: Date; durationMs: number } | undefined {
  const keys = ENTITY_RUN_ALIASES[entity] ?? [entity];
  let best: { recordsProcessed: number; createdAt: Date; durationMs: number } | undefined;
  for (const key of keys) {
    const run = latestRuns.get(key);
    if (!run) continue;
    if (!best || run.createdAt > best.createdAt) best = run;
  }
  return best;
}

export async function buildSyncCompletenessSummary(
  ownerUserId: string,
  snapshot: Cin7ReconciliationSnapshot
): Promise<Cin7SyncCompletenessRow[]> {
  const entities = [
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
  ];

  const latestRuns = await getLatestCin7SyncRunsByEntity(ownerUserId, [
    ...entities,
    'inventory',
    'warehouses',
  ]);

  return entities.map((entity) => {
    const cin7Count = cin7CountForEntity(snapshot, entity);
    const optixCount = optixCountForEntity(snapshot, entity);
    const run = pickLatestRun(latestRuns, entity);
    const lastSyncRecords = run?.recordsProcessed ?? null;
    const lastSyncAt = run?.createdAt.toISOString() ?? null;

    let likelyIncomplete = false;
    let note: string | undefined;

    if (cin7Count != null && optixCount != null && cin7Count > 0) {
      const tolerance =
        entity === 'brands' || entity === 'tax-codes' || entity === 'units-of-measure'
          ? 0.05
          : 0.02;
      const minExpected = Math.floor(cin7Count * (1 - tolerance));
      if (optixCount < minExpected) {
        likelyIncomplete = true;
        note = `Optix has ${optixCount.toLocaleString()} linked records but Cin7 has ~${cin7Count.toLocaleString()}. Re-run sync (resume if timed out).`;
      }
    } else if (cin7Count != null && cin7Count > 0 && run == null) {
      likelyIncomplete = true;
      note = 'No recent sync run found for this entity.';
    }

    if (run && run.durationMs >= getSyncTimeBudgetWarningMs()) {
      note = note
        ? `${note} Last run used ${Math.round(run.durationMs / 1000)}s — may have hit the time limit.`
        : `Last run used ${Math.round(run.durationMs / 1000)}s — may have hit the time limit; use resume if counts are short.`;
    }

    return {
      entity,
      label: ENTITY_LABELS[entity] ?? entity,
      cin7_count: cin7Count,
      last_sync_records: lastSyncRecords,
      last_sync_at: lastSyncAt,
      last_sync_duration_ms: run?.durationMs ?? null,
      likely_incomplete: likelyIncomplete,
      note,
    };
  });
}

function getSyncTimeBudgetWarningMs(): number {
  const n = Number(process.env.CIN7_SYNC_TIME_BUDGET_MS || 280_000);
  return Math.max(240_000, n - 10_000);
}
