import { prisma } from '@/lib/db/prisma';
import { AREA1_FREEZE } from '@/lib/phase2/schedule-a';
import { Prisma } from '@prisma/client';

export const PHASE2_ASOF_MODE = 'phase2_asof';

export type Phase2AsOfSummary = {
  kind: 'phase2_asof';
  freeze: typeof AREA1_FREEZE;
  optix_captured_at: string;
  optix_qty_total: number;
  optix_keys: number;
  optix_per_branch: Array<{ branch: string; qty: number }>;
  anne: {
    captured_at: string;
    run_timestamp: string;
    qty_total: number;
    value: number | null;
  } | null;
};

export async function capturePhase2AsOf(ownerUserId: string): Promise<{
  id: string;
  summary: Phase2AsOfSummary;
}> {
  const rows = await prisma.cin7StockLevel.findMany({
    where: { ownerUserId },
    select: { sku: true, branchName: true, cin7BranchId: true, stockOnHand: true },
  });
  const byBranch = new Map<string, number>();
  let qty = 0;
  for (const row of rows) {
    const q = Number(row.stockOnHand);
    qty += q;
    const branch = row.branchName?.trim() || row.cin7BranchId;
    byBranch.set(branch, (byBranch.get(branch) ?? 0) + q);
  }
  const summary: Phase2AsOfSummary = {
    kind: 'phase2_asof',
    freeze: AREA1_FREEZE,
    optix_captured_at: new Date().toISOString(),
    optix_qty_total: Math.round(qty * 10000) / 10000,
    optix_keys: rows.length,
    optix_per_branch: [...byBranch.entries()]
      .map(([branch, q]) => ({ branch, qty: Math.round(q * 10000) / 10000 }))
      .sort((a, b) => b.qty - a.qty),
    anne: null,
  };
  const run = await prisma.cin7ReconRun.create({
    data: {
      ownerUserId,
      status: 'complete',
      mode: PHASE2_ASOF_MODE,
      immutable: true,
      optixComplete: rows.length > 0,
      cin7Complete: false,
      summary: summary as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  return { id: run.id, summary };
}

export async function attachAnneToPhase2AsOf(input: {
  ownerUserId: string;
  snapshotId: string;
  runTimestamp: string;
  qtyTotal: number;
  value?: number | null;
}): Promise<Phase2AsOfSummary> {
  const run = await prisma.cin7ReconRun.findFirst({
    where: { id: input.snapshotId, ownerUserId: input.ownerUserId, mode: PHASE2_ASOF_MODE },
  });
  if (!run?.summary || typeof run.summary !== 'object') {
    throw new Error('Phase 2 as-of snapshot not found.');
  }
  const current = run.summary as unknown as Phase2AsOfSummary;
  if (current.kind !== 'phase2_asof') {
    throw new Error('That recon run is not a Phase 2 as-of snapshot.');
  }
  const next: Phase2AsOfSummary = {
    ...current,
    anne: {
      captured_at: new Date().toISOString(),
      run_timestamp: input.runTimestamp,
      qty_total: input.qtyTotal,
      value: input.value ?? null,
    },
  };
  await prisma.cin7ReconRun.update({
    where: { id: run.id },
    data: {
      summary: next as unknown as Prisma.InputJsonValue,
      cin7Complete: true,
    },
  });
  return next;
}

export async function loadLatestPhase2AsOf(
  ownerUserId: string
): Promise<{ id: string; summary: Phase2AsOfSummary } | null> {
  const run = await prisma.cin7ReconRun.findFirst({
    where: { ownerUserId, mode: PHASE2_ASOF_MODE, immutable: true },
    orderBy: { checkedAt: 'desc' },
  });
  if (!run?.summary || typeof run.summary !== 'object') return null;
  const summary = run.summary as unknown as Phase2AsOfSummary;
  if (summary.kind !== 'phase2_asof') return null;
  return { id: run.id, summary };
}
