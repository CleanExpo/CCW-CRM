import { requireAuthScope } from '@/lib/auth/data-scope';
import { buildCin7Reconciliation } from '@/lib/integrations/cin7-reconciliation';
import {
  getOrBuildReconciliation,
  getReconciliationCacheTtlMs,
} from '@/lib/integrations/cin7-reconciliation-cache';
import { runFailClosedReconciliation } from '@/lib/integrations/cin7-reconciliation-job';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get('force') === 'true';
  const mode = request.nextUrl.searchParams.get('mode')?.trim().toLowerCase();

  try {
    // Sign-off path: DB-backed fail-closed gate (never clean zeros on incomplete sync).
    if (mode === 'acceptance') {
      const view = await runFailClosedReconciliation(scope.userId);
      return NextResponse.json({
        ...view,
        cache_meta: {
          from_cache: false,
          cached_at: null,
          ttl_ms: getReconciliationCacheTtlMs(),
          force_requested: force,
          mode: 'acceptance',
        },
      });
    }

    const result = await getOrBuildReconciliation(
      scope.userId,
      () => buildCin7Reconciliation(scope.userId),
      { force }
    );

    return NextResponse.json({
      ...result.snapshot,
      cache_meta: {
        from_cache: result.from_cache,
        cached_at: result.cached_at,
        ttl_ms: getReconciliationCacheTtlMs(),
        force_requested: force,
        mode: 'live',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Reconciliation failed';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
