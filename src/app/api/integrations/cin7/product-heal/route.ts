import { requireAuthScope } from '@/lib/auth/data-scope';
import { runAuditedFieldHeal } from '@/lib/integrations/cin7-heal-audit';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';
import { clearCachedReconciliation } from '@/lib/integrations/cin7-reconciliation-cache';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

/**
 * @deprecated Prefer POST /api/integrations/cin7/field-heal.
 * Products-only explicit heal with audit log.
 */
export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }
  const omniCreds = getCin7OmniCredentials(request);
  if (!omniCreds || !(await pingCin7Omni(omniCreds))) {
    return NextResponse.json({ detail: 'Cin7 Omni is not reachable.' }, { status: 401 });
  }

  const result = await runAuditedFieldHeal({
    ownerUserId: scope.userId,
    actorUserId: scope.userId,
    omniCreds,
    entities: ['products'],
  });
  const products = result.by_entity.products;
  if (result.errors.length > 0 && products.healed === 0 && products.checked === 0) {
    return NextResponse.json(
      { detail: 'Cin7 product catalog incomplete — heal aborted.', ...result },
      { status: 502 }
    );
  }

  clearCachedReconciliation(scope.userId);
  return NextResponse.json({
    healed: products.healed,
    checked: products.checked,
    cin7_skus: products.checked,
    mismatched_before: products.healed,
    audit_run_id: result.audit_run_id,
    errors: result.errors,
    summary: result.summary,
    accepted: result.errors.length === 0,
    reversible: true,
  });
}
