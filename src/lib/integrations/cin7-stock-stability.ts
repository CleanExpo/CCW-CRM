/**
 * Cin7 stock-count stability for the prune lock.
 *
 * The client asked not to prune until the Cin7 stock row count from three
 * consecutive complete acceptance runs is stable. A truncated snapshot is not
 * a sign-off number and cannot unlock prune.
 */

import { prisma } from '@/lib/db/prisma';
import type {
  Cin7ReconciliationSnapshot,
  Cin7StockCatalogEvidence,
} from '@/lib/integrations/cin7-reconciliation';

export const CIN7_STOCK_STABILITY_RUNS_REQUIRED = 3;

export const CIN7_STOCK_PRUNE_LOCKED_DETAIL =
  'Stock prune is locked until three consecutive complete acceptance runs show a stable Cin7 stock row count. The client asked not to prune against a moving or truncated Cin7 catalog.';

export type { Cin7StockCatalogEvidence };

export type Cin7StockStabilityRun = {
  id: string;
  checked_at: string;
  status: string;
  stock_cin7: number | null;
  stock_optix: number | null;
  cin7_reported_total: number | null;
  truncated: boolean;
  complete: boolean;
};

export type Cin7StockPruneAuditSummary = {
  id: string;
  created_at: string;
  deleted_total: number;
  status: string;
  reversible: boolean;
};

export type Cin7StockStabilityReport = {
  stable: boolean;
  prune_enabled: boolean;
  required: number;
  observed: number;
  cin7_counts: Array<number | null>;
  reason: string;
  runs: Cin7StockStabilityRun[];
  last_prune_audit: Cin7StockPruneAuditSummary | null;
  revert_how: string;
};

export const CIN7_STOCK_PRUNE_REVERT_HOW =
  'Prune is a separate audited action, not part of the recon report. Each deleted Optix stock row is stored on cin7_heal_audit_rows.before_json (branch, SKU, quantities). Revert restores those rows via POST /api/integrations/cin7/heal-audit/revert with the prune audit id. A reverted run cannot be reverted twice.';

export function extractStockEvidence(
  summary: Partial<Cin7ReconciliationSnapshot> | null | undefined
): Pick<Cin7StockStabilityRun, 'stock_cin7' | 'stock_optix' | 'cin7_reported_total' | 'truncated'> {
  const evidence = summary?.stock_evidence;
  return {
    stock_cin7: evidence?.cin7_rows ?? summary?.cin7?.reference?.stock_levels ?? null,
    stock_optix: summary?.optix?.reference?.stock_levels ?? null,
    cin7_reported_total: evidence?.cin7_reported_total ?? null,
    truncated: Boolean(evidence?.truncated || summary?.fetch_meta?.incomplete),
  };
}

export function assessCin7StockStability(runs: Cin7StockStabilityRun[]): {
  stable: boolean;
  required: number;
  observed: number;
  cin7_counts: Array<number | null>;
  reason: string;
} {
  const required = CIN7_STOCK_STABILITY_RUNS_REQUIRED;
  const consecutive = runs.slice(0, required);
  const cin7_counts = consecutive.map((run) => run.stock_cin7);
  const observed = consecutive.length;

  if (observed < required) {
    return {
      stable: false,
      required,
      observed,
      cin7_counts,
      reason: `Need ${required} consecutive complete acceptance runs with Cin7 stock counts; ${observed} available.`,
    };
  }

  if (consecutive.some((run) => run.truncated || !run.complete)) {
    return {
      stable: false,
      required,
      observed,
      cin7_counts,
      reason:
        'One or more of the last three acceptance runs is truncated or incomplete, so the Cin7 stock count is not a sign-off number.',
    };
  }

  if (consecutive.some((run) => run.stock_cin7 == null)) {
    return {
      stable: false,
      required,
      observed,
      cin7_counts,
      reason: 'One or more of the last three acceptance runs is missing a Cin7 stock row count.',
    };
  }

  const first = consecutive[0]?.stock_cin7;
  const allSame = consecutive.every((run) => run.stock_cin7 === first);
  if (!allSame) {
    return {
      stable: false,
      required,
      observed,
      cin7_counts,
      reason: `Cin7 stock counts from the last ${required} complete acceptance runs are not identical (${cin7_counts.join(', ')}). Prune stays locked.`,
    };
  }

  return {
    stable: true,
    required,
    observed,
    cin7_counts,
    reason: `Cin7 stock row count held at ${first} across ${required} consecutive complete acceptance runs.`,
  };
}

export async function listRecentCompleteAcceptanceStockRuns(
  ownerUserId: string,
  take = CIN7_STOCK_STABILITY_RUNS_REQUIRED
): Promise<Cin7StockStabilityRun[]> {
  const rows = await prisma.cin7ReconRun.findMany({
    where: {
      ownerUserId,
      immutable: true,
      mode: 'acceptance',
      status: 'complete',
    },
    orderBy: { checkedAt: 'desc' },
    take: Math.min(20, Math.max(1, take)),
    select: {
      id: true,
      status: true,
      checkedAt: true,
      summary: true,
    },
  });

  return rows.map((row) => {
    const summary = (row.summary ?? {}) as Partial<Cin7ReconciliationSnapshot>;
    const extracted = extractStockEvidence(summary);
    const evidenceComplete = summary.stock_evidence
      ? summary.stock_evidence.complete
      : row.status === 'complete' && !extracted.truncated;
    return {
      id: row.id,
      checked_at: row.checkedAt.toISOString(),
      status: row.status,
      complete: row.status === 'complete' && evidenceComplete,
      ...extracted,
    };
  });
}

export async function getLastStockPruneAudit(
  ownerUserId: string
): Promise<Cin7StockPruneAuditSummary | null> {
  const row = await prisma.cin7HealAuditRun.findFirst({
    where: { ownerUserId, actionType: 'stock_prune' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      deletedTotal: true,
      status: true,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    created_at: row.createdAt.toISOString(),
    deleted_total: row.deletedTotal,
    status: row.status,
    reversible: row.status === 'applied',
  };
}

export async function getCin7StockStability(
  ownerUserId: string
): Promise<Cin7StockStabilityReport> {
  const [runs, lastPrune] = await Promise.all([
    listRecentCompleteAcceptanceStockRuns(ownerUserId, CIN7_STOCK_STABILITY_RUNS_REQUIRED),
    getLastStockPruneAudit(ownerUserId),
  ]);
  const assessed = assessCin7StockStability(runs);
  return {
    ...assessed,
    prune_enabled: assessed.stable,
    runs,
    last_prune_audit: lastPrune,
    revert_how: CIN7_STOCK_PRUNE_REVERT_HOW,
  };
}

export async function isCin7StockPruneEnabled(ownerUserId: string): Promise<boolean> {
  const report = await getCin7StockStability(ownerUserId);
  return report.prune_enabled;
}
