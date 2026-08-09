import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import { persistImmutableReconSnapshot } from '@/lib/integrations/cin7-recon-snapshot-store';
import { buildCin7Reconciliation } from '@/lib/integrations/cin7-reconciliation';
import {
  getOrBuildReconciliation,
  getReconciliationCacheTtlMs,
} from '@/lib/integrations/cin7-reconciliation-cache';
import { runFailClosedReconciliation } from '@/lib/integrations/cin7-reconciliation-job';
import { Prisma } from '@prisma/client';
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
      // Mark the fail-closed run immutable for sign-off (do not create a duplicate row).
      if (view.recon_run_id) {
        await prisma.cin7ReconRun.update({
          where: { id: view.recon_run_id },
          data: {
            mode: 'acceptance',
            immutable: true,
            summary: view as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return NextResponse.json({
        ...view,
        read_only: true,
        owner_scope_note:
          'This snapshot belongs to your Optix account only. Other users on the same URL have separate ledgers.',
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

    let reconRunId: string | null = null;
    // Persist every fresh live pull as an immutable measurement record (B5).
    if (!result.from_cache || force) {
      const persisted = await persistImmutableReconSnapshot({
        ownerUserId: scope.userId,
        mode: 'live',
        snapshot: result.snapshot,
      });
      reconRunId = persisted.recon_run_id;
    }

    return NextResponse.json({
      ...result.snapshot,
      recon_run_id: reconRunId,
      read_only: true,
      owner_scope_note:
        'Cin7 sync runs and reconciliation are scoped per Optix account (ownerUserId). Two logins on the same production URL can show different last-sync times and counts.',
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
