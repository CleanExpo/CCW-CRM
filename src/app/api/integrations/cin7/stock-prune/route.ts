import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import { runAuditedStockPrune } from '@/lib/integrations/cin7-heal-audit';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';
import { clearCachedReconciliation } from '@/lib/integrations/cin7-reconciliation-cache';
import {
  CIN7_STOCK_PRUNE_LOCKED_DETAIL,
  getCin7StockStability,
} from '@/lib/integrations/cin7-stock-stability';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

/**
 * Explicit stock surplus prune (Cin7 source of truth).
 * Not part of reconciliation reporting. POST writes an audit log for revert.
 * GET → dry-run preview only.
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const omniCreds = getCin7OmniCredentials(request);
  if (!omniCreds || !(await pingCin7Omni(omniCreds))) {
    return NextResponse.json({ detail: 'Cin7 Omni is not reachable.' }, { status: 401 });
  }
  const result = await runAuditedStockPrune({
    ownerUserId: scope.userId,
    actorUserId: scope.userId,
    omniCreds,
    dryRun: true,
  });
  return NextResponse.json({ ...result, explicit_action: true });
}

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const stability = await getCin7StockStability(scope.userId);
  if (!stability.prune_enabled) {
    return NextResponse.json(
      {
        detail: CIN7_STOCK_PRUNE_LOCKED_DETAIL,
        prune_enabled: false,
        stability,
      },
      { status: 409 }
    );
  }

  const omniCreds = getCin7OmniCredentials(request);
  if (!omniCreds || !(await pingCin7Omni(omniCreds))) {
    return NextResponse.json({ detail: 'Cin7 Omni is not reachable.' }, { status: 401 });
  }

  const result = await runAuditedStockPrune({
    ownerUserId: scope.userId,
    actorUserId: scope.userId,
    omniCreds,
    dryRun: false,
  });

  if (result.errors.length > 0 && result.deleted === 0 && result.cin7_keys === 0) {
    return NextResponse.json(
      { detail: 'Cin7 stock catalog incomplete — prune aborted.', ...result },
      { status: 502 }
    );
  }

  const live = await prisma.cin7StockLevel.count({ where: { ownerUserId: scope.userId } });
  const accepted =
    result.errors.length === 0 && result.missing_in_optix === 0 && result.cin7_keys > 0;
  await prisma.cin7SyncRun.updateMany({
    where: {
      ownerUserId: scope.userId,
      entityType: { in: ['stock-levels', 'inventory'] },
    },
    data: accepted
      ? {
          recordsProcessed: live,
          status: 'complete',
          nextPage: null,
          failedPage: null,
          failureReason: null,
          completedAt: new Date(),
        }
      : {
          recordsProcessed: live,
          status: 'incomplete',
          nextPage: 1,
          failedPage: 1,
          failureReason:
            result.errors[0] ??
            (result.missing_in_optix > 0
              ? `Stock prune left ${result.missing_in_optix} Cin7 keys missing in Optix.`
              : 'Stock prune did not accept — Cin7 catalog empty or incomplete.'),
          completedAt: null,
        },
  });
  clearCachedReconciliation(scope.userId);

  return NextResponse.json({
    ...result,
    optix_after: live,
    accepted,
    explicit_action: true,
    reversible: true,
  });
}
