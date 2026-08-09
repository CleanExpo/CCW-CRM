import { requireAuthScope } from '@/lib/auth/data-scope';
import { revertHealAuditRun } from '@/lib/integrations/cin7-heal-audit';
import { clearCachedReconciliation } from '@/lib/integrations/cin7-reconciliation-cache';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

/** Reverse a prior explicit field-heal or stock-prune using stored before-images. */
export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { audit_run_id?: string } | null;
  const auditRunId = body?.audit_run_id?.trim();
  if (!auditRunId) {
    return NextResponse.json({ detail: 'audit_run_id is required' }, { status: 400 });
  }

  try {
    const result = await revertHealAuditRun({
      ownerUserId: scope.userId,
      actorUserId: scope.userId,
      auditRunId,
    });
    clearCachedReconciliation(scope.userId);
    return NextResponse.json({ ...result, accepted: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Revert failed' },
      { status: 400 }
    );
  }
}
