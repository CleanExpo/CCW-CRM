import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import { CIN7_SYNCABLE_ENTITY_TYPES } from '@/lib/integrations/cin7-master-entities';
import { toCin7SyncDisplayStatus } from '@/lib/integrations/cin7-sync-display';
import { recoverStaleCin7SyncRuns } from '@/lib/integrations/cin7-sync-engine';
import { getOptixEntityRecordCount } from '@/lib/integrations/cin7-sync-incremental';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Latest Cin7 sync status per entity for the integrations history panel.
 * Client-facing status is only complete | incomplete.
 * records_processed prefers live Optix counts so Recent sync matches recon after prune.
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  void request.nextUrl.searchParams.get('limit');

  try {
    // Heal idle / failed / abandoned running → incomplete before reading.
    await recoverStaleCin7SyncRuns(scope.userId);

    const runs = await prisma.cin7SyncRun.findMany({
      where: {
        ownerUserId: scope.userId,
        entityType: { in: [...CIN7_SYNCABLE_ENTITY_TYPES] },
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        entityType: true,
        status: true,
        recordsProcessed: true,
        durationMs: true,
        source: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        lastCommittedPage: true,
        nextPage: true,
        failedPage: true,
        failureReason: true,
      },
    });

    const byEntity = new Map(runs.map((run) => [run.entityType, run]));

    // Live Optix counts — Recent sync must match master recon after stock prune/deletes.
    const optixCounts = new Map<string, number>();
    await Promise.all(
      CIN7_SYNCABLE_ENTITY_TYPES.map(async (entityType) => {
        if (entityType === 'orders') return;
        const count = await getOptixEntityRecordCount(scope.userId, entityType);
        optixCounts.set(entityType, count);
      })
    );

    // Heal stale stock/inventory run counters left high after surplus prune.
    const healWrites: Promise<unknown>[] = [];
    for (const entityType of ['stock-levels', 'inventory'] as const) {
      const run = byEntity.get(entityType);
      const live = optixCounts.get(entityType);
      if (!run || live == null || run.recordsProcessed === live) continue;
      healWrites.push(
        prisma.cin7SyncRun.update({
          where: { id: run.id },
          data: { recordsProcessed: live },
        })
      );
      byEntity.set(entityType, { ...run, recordsProcessed: live });
    }
    if (healWrites.length > 0) {
      await Promise.all(healWrites);
    }

    const logs = CIN7_SYNCABLE_ENTITY_TYPES.map((entityType) => {
      const run = byEntity.get(entityType);
      if (!run) {
        return {
          id: `pending:${entityType}`,
          entity_type: entityType,
          direction: 'pull',
          status: 'incomplete' as const,
          records_processed: optixCounts.get(entityType) ?? 0,
          synced_at: null as string | null,
          error_message: undefined as string | undefined,
          last_committed_page: 0,
          failed_page: null as number | null,
          next_page: null as number | null,
          completed_at: null as string | null,
        };
      }
      const syncedAt =
        run.completedAt?.toISOString() ??
        (run.status === 'complete' ? run.updatedAt.toISOString() : run.updatedAt.toISOString());
      const live = entityType === 'orders' ? null : (optixCounts.get(entityType) ?? null);
      const recordsProcessed =
        live != null && (run.status === 'complete' || live > 0) ? live : run.recordsProcessed;
      return {
        id: run.id,
        entity_type: run.entityType,
        direction: 'pull',
        // Only complete | incomplete for Settings UI — never idle / failed / running.
        status: toCin7SyncDisplayStatus(run.status),
        records_processed: recordsProcessed,
        synced_at: syncedAt,
        error_message: run.failureReason ?? undefined,
        last_committed_page: run.lastCommittedPage,
        failed_page: run.failedPage,
        next_page: run.nextPage,
        completed_at: run.completedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ logs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load sync logs';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
