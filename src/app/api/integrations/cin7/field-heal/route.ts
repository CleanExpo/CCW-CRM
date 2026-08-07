import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  healOptixFieldMismatchesFromLiveCin7,
  summarizeFieldHeal,
  type Cin7FieldHealEntity,
} from '@/lib/integrations/cin7-field-heal';
import { getCin7OmniCredentials, pingCin7Omni } from '@/lib/integrations/cin7-omni';
import { clearCachedReconciliation } from '@/lib/integrations/cin7-reconciliation-cache';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

const VALID_ENTITIES = new Set<Cin7FieldHealEntity>([
  'products',
  'customers',
  'suppliers',
  'branches',
  'internal-customers',
  'stock',
]);

/**
 * Align Optix field diffs to live Cin7 for products, customers, suppliers,
 * branches, internal customers, and stock (matched keys only).
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

  let entities: Cin7FieldHealEntity[] | undefined;
  try {
    const body = (await request.json().catch(() => null)) as {
      entities?: unknown;
    } | null;
    if (Array.isArray(body?.entities)) {
      entities = body.entities.filter(
        (e): e is Cin7FieldHealEntity =>
          typeof e === 'string' && VALID_ENTITIES.has(e as Cin7FieldHealEntity)
      );
      if (entities.length === 0) entities = undefined;
    }
  } catch {
    entities = undefined;
  }

  const result = await healOptixFieldMismatchesFromLiveCin7(scope.userId, omniCreds, {
    entities,
  });

  const anyCatalogUsable = Object.values(result.by_entity).some(
    (row) => row.checked > 0 || row.healed > 0
  );
  if (result.errors.length > 0 && result.healed_total === 0 && !anyCatalogUsable) {
    return NextResponse.json(
      {
        detail: 'Cin7 catalogs incomplete — field heal aborted.',
        summary: summarizeFieldHeal(result),
        ...result,
      },
      { status: 502 }
    );
  }

  clearCachedReconciliation(scope.userId);
  return NextResponse.json({
    ...result,
    summary: summarizeFieldHeal(result),
    accepted: result.errors.length === 0,
  });
}
