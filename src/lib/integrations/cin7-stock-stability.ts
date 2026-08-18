/**
 * Live Cin7 stock-count observation (drift), plus the D10 freeze prune lock.
 *
 * Identical live counts do not unlock prune. Cin7 Omni has no historical as-of;
 * prune uses a named freeze keyset. Acceptance-run counts are trading evidence.
 */

import { prisma } from '@/lib/db/prisma';
import type {
  Cin7ReconciliationSnapshot,
  Cin7StockCatalogEvidence,
} from '@/lib/integrations/cin7-reconciliation';
import {
  assessCin7StockFreeze,
  loadLatestStockFreeze,
  type Cin7StockFreezeRecord,
} from '@/lib/integrations/cin7-stock-freeze';

export const CIN7_STOCK_STABILITY_RUNS_REQUIRED = 3;

export const CIN7_STOCK_PRUNE_LOCKED_DETAIL =
  'Stock prune is locked until a complete D10 freeze (as-of Cin7 stock keyset) is captured. Do not prune against a live catalog.';

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
  /** True when a complete D10 freeze exists (same as prune_enabled). */
  stable: boolean;
  prune_enabled: boolean;
  required: number;
  observed: number;
  cin7_counts: Array<number | null>;
  counts_identical: boolean;
  /** Freeze gate — why prune is locked or unlocked. */
  reason: string;
  /** Observational live-count copy; never a prune unlock. */
  live_reason: string;
  freeze: Cin7StockFreezeRecord | null;
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
  counts_identical: boolean;
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
      counts_identical: false,
      required,
      observed,
      cin7_counts,
      reason: `Need ${required} consecutive complete acceptance runs to observe the live Cin7 catalog; ${observed} available.`,
    };
  }

  if (consecutive.some((run) => run.truncated || !run.complete)) {
    return {
      counts_identical: false,
      required,
      observed,
      cin7_counts,
      reason:
        'One or more of the last three acceptance runs is truncated or incomplete, so those live Cin7 counts are not comparable.',
    };
  }

  if (consecutive.some((run) => run.stock_cin7 == null)) {
    return {
      counts_identical: false,
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
      counts_identical: false,
      required,
      observed,
      cin7_counts,
      reason: `Live Cin7 catalog still moves (${cin7_counts.join(', ')}). This is trading evidence, not a prune lock — prune uses a D10 freeze.`,
    };
  }

  return {
    counts_identical: true,
    required,
    observed,
    cin7_counts,
    reason: `Live Cin7 counts matched at ${first} across ${required} runs. The live Cin7 catalog still moves; prune unlocks from a D10 freeze, not identical counts.`,
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
  const [runs, lastPrune, freeze] = await Promise.all([
    listRecentCompleteAcceptanceStockRuns(ownerUserId, CIN7_STOCK_STABILITY_RUNS_REQUIRED),
    getLastStockPruneAudit(ownerUserId),
    loadLatestStockFreeze(ownerUserId),
  ]);
  const live = assessCin7StockStability(runs);
  const freezeGate = assessCin7StockFreeze(freeze);
  return {
    counts_identical: live.counts_identical,
    required: live.required,
    observed: live.observed,
    cin7_counts: live.cin7_counts,
    live_reason: live.reason,
    reason: freezeGate.reason,
    stable: freezeGate.prune_enabled,
    prune_enabled: freezeGate.prune_enabled,
    freeze,
    runs,
    last_prune_audit: lastPrune,
    revert_how: CIN7_STOCK_PRUNE_REVERT_HOW,
  };
}

export async function isCin7StockPruneEnabled(ownerUserId: string): Promise<boolean> {
  const report = await getCin7StockStability(ownerUserId);
  return report.prune_enabled;
}
