import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import { CIN7_SYNCABLE_ENTITY_TYPES } from '@/lib/integrations/cin7-master-entities';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Latest Cin7 sync status per entity for the integrations history panel.
 * Path is /sync-history (not /sync/logs) so it is not blocked by the repo `logs/` gitignore,
 * and does not collide with POST /sync/[entityType].
 *
 * Always returns one entry per syncable entity (never-synced entities included with null stats).
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  // Limit is retained for API compatibility; we always cover all syncable entities.
  void request.nextUrl.searchParams.get('limit');

  try {
    const runs = await prisma.cin7SyncRun.findMany({
      where: {
        ownerUserId: scope.userId,
        entityType: { in: [...CIN7_SYNCABLE_ENTITY_TYPES] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        entityType: true,
        recordsProcessed: true,
        durationMs: true,
        source: true,
        createdAt: true,
      },
    });

    const byEntity = new Map(runs.map((run) => [run.entityType, run]));

    const logs = CIN7_SYNCABLE_ENTITY_TYPES.map((entityType) => {
      const run = byEntity.get(entityType);
      if (!run) {
        return {
          id: `pending:${entityType}`,
          entity_type: entityType,
          direction: 'pull',
          status: 'never',
          records_processed: 0,
          synced_at: null as string | null,
          error_message: undefined as string | undefined,
        };
      }
      return {
        id: run.id,
        entity_type: run.entityType,
        direction: 'pull',
        status: 'ok',
        records_processed: run.recordsProcessed,
        synced_at: run.createdAt.toISOString(),
        error_message: undefined as string | undefined,
      };
    });

    return NextResponse.json({ logs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load sync logs';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
