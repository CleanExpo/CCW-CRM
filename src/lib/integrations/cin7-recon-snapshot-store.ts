/**
 * Persist immutable, timestamped reconciliation snapshots for sign-off (B5).
 * Live recon is read-only measurement; these rows are never mutated after insert.
 */

import { prisma } from '@/lib/db/prisma';
import type { Cin7ReconciliationSnapshot } from '@/lib/integrations/cin7-reconciliation';
import { Prisma } from '@prisma/client';

function fieldMismatchTotal(snapshot: Cin7ReconciliationSnapshot): number {
  const ex = snapshot.exceptions_summary;
  return (
    (ex.products_field_mismatches ?? 0) +
    (ex.customers_field_mismatches ?? 0) +
    (ex.suppliers_field_mismatches ?? 0) +
    (ex.branches_field_mismatches ?? 0) +
    (ex.internal_customers_field_mismatches ?? 0) +
    (ex.stock_levels_field_mismatches ?? 0)
  );
}

function missingTotal(snapshot: Cin7ReconciliationSnapshot): number {
  const ex = snapshot.exceptions_summary;
  return (
    (ex.products_missing_in_optix ?? 0) +
    (ex.customers_missing_in_optix ?? 0) +
    (ex.suppliers_missing_in_optix ?? 0) +
    (ex.branches_missing_in_optix ?? 0) +
    (ex.internal_customers_missing_in_optix ?? 0) +
    (ex.stock_levels_missing_in_optix ?? 0) +
    (ex.tax_codes_missing_in_optix ?? 0)
  );
}

function extraTotal(snapshot: Cin7ReconciliationSnapshot): number {
  const ex = snapshot.exceptions_summary;
  return (
    (ex.products_extra_in_optix ?? 0) +
    (ex.customers_extra_in_optix ?? 0) +
    (ex.suppliers_extra_in_optix ?? 0) +
    (ex.branches_extra_in_optix ?? 0) +
    (ex.stock_levels_extra_in_optix ?? 0)
  );
}

/** Store a live (or acceptance) measurement snapshot. Never updates existing rows. */
export async function persistImmutableReconSnapshot(input: {
  ownerUserId: string;
  mode: 'live' | 'acceptance';
  snapshot: Cin7ReconciliationSnapshot;
  reconStatus?: string;
  blockedReason?: string | null;
}): Promise<{ recon_run_id: string }> {
  const { snapshot } = input;
  const incomplete = Boolean(snapshot.acceptance_blocked || snapshot.fetch_meta.incomplete);
  const status = incomplete ? 'blocked' : input.reconStatus === 'failed' ? 'failed' : 'complete';

  const row = await prisma.cin7ReconRun.create({
    data: {
      ownerUserId: input.ownerUserId,
      mode: input.mode,
      immutable: true,
      status,
      blockedReason:
        input.blockedReason ?? (incomplete ? 'Cin7 fetch incomplete or acceptance blocked' : null),
      optixComplete: !incomplete,
      cin7Complete: !incomplete && snapshot.source !== 'none',
      missingCount: missingTotal(snapshot),
      extraCount: extraTotal(snapshot),
      linkedCount: snapshot.optix.products.skus,
      fieldMismatchCount: fieldMismatchTotal(snapshot),
      skippedCount: 0,
      summary: snapshot as unknown as Prisma.InputJsonValue,
      checkedAt: new Date(snapshot.checked_at),
      completedAt: new Date(),
    },
    select: { id: true },
  });

  return { recon_run_id: row.id };
}

export type Cin7ReconHistoryItem = {
  id: string;
  mode: string;
  status: string;
  checked_at: string;
  immutable: boolean;
  missing_count: number;
  extra_count: number;
  field_mismatch_count: number;
  products_cin7: number | null;
  products_optix: number | null;
  stock_cin7: number | null;
  stock_optix: number | null;
  stock_reported_total: number | null;
  stock_truncated: boolean;
};

export async function listImmutableReconSnapshots(
  ownerUserId: string,
  limit = 20
): Promise<Cin7ReconHistoryItem[]> {
  const rows = await prisma.cin7ReconRun.findMany({
    where: { ownerUserId, immutable: true, mode: { in: ['live', 'acceptance'] } },
    orderBy: { checkedAt: 'desc' },
    take: Math.min(50, Math.max(1, limit)),
    select: {
      id: true,
      mode: true,
      status: true,
      checkedAt: true,
      immutable: true,
      missingCount: true,
      extraCount: true,
      fieldMismatchCount: true,
      summary: true,
    },
  });

  return rows.map((row) => {
    const summary = (row.summary ?? {}) as Partial<Cin7ReconciliationSnapshot>;
    const evidence = summary.stock_evidence;
    return {
      id: row.id,
      mode: row.mode,
      status: row.status,
      checked_at: row.checkedAt.toISOString(),
      immutable: row.immutable,
      missing_count: row.missingCount,
      extra_count: row.extraCount,
      field_mismatch_count: row.fieldMismatchCount,
      products_cin7: summary.cin7?.products?.skus ?? null,
      products_optix: summary.optix?.products?.skus ?? null,
      stock_cin7: evidence?.cin7_rows ?? summary.cin7?.reference?.stock_levels ?? null,
      stock_optix: summary.optix?.reference?.stock_levels ?? null,
      stock_reported_total: evidence?.cin7_reported_total ?? null,
      stock_truncated: Boolean(evidence?.truncated),
    };
  });
}

export async function getImmutableReconSnapshot(
  ownerUserId: string,
  reconRunId: string
): Promise<(Cin7ReconciliationSnapshot & { recon_run_id: string; mode: string }) | null> {
  const row = await prisma.cin7ReconRun.findFirst({
    where: { id: reconRunId, ownerUserId, immutable: true },
  });
  if (!row?.summary || typeof row.summary !== 'object') return null;
  if (row.mode === 'freeze') return null;
  const snapshot = row.summary as Cin7ReconciliationSnapshot;
  return {
    ...snapshot,
    recon_run_id: row.id,
    mode: row.mode,
  };
}
