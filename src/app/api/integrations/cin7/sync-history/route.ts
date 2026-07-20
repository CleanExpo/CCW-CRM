import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Recent Cin7 sync runs for the integrations UI history panel.
 * Path is /sync-history (not /sync/logs) so it is not blocked by the repo `logs/` gitignore.
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 20, 1), 100);

  try {
    const runs = await prisma.cin7SyncRun.findMany({
      where: { ownerUserId: scope.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        entityType: true,
        recordsProcessed: true,
        durationMs: true,
        source: true,
        createdAt: true,
      },
    });

    const logs = runs.map((run) => ({
      id: run.id,
      entity_type: run.entityType,
      direction: 'pull',
      status: 'ok',
      records_processed: run.recordsProcessed,
      synced_at: run.createdAt.toISOString(),
      error_message: undefined as string | undefined,
    }));

    return NextResponse.json({ logs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load sync logs';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
