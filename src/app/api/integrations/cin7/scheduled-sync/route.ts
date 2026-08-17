import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import {
  CIN7_SCHEDULED_SYNC_ENTITY_ORDER,
  CIN7_SYNC_SCHEDULE_LABEL,
  formatCountdownUntil,
} from '@/lib/integrations/cin7-scheduled-sync';
import { getCin7SchedulerSnapshot } from '@/lib/integrations/cin7-server-scheduler';
import { NextRequest, NextResponse } from 'next/server';

type EntityResults = Record<
  string,
  { status?: string; complete?: boolean; records?: number; resumed?: boolean }
>;

/** Live status of the server Cin7 schedule. Does not start a sync. */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const snapshot = getCin7SchedulerSnapshot();
  const ownerIds = [...new Set([scope.userId, snapshot.actorUserId].filter(Boolean))] as string[];
  const latest = await prisma.cin7NightlySyncLedger.findFirst({
    where: { ownerUserId: { in: ownerIds } },
    orderBy: { startedAt: 'desc' },
  });

  const entityResults = (latest?.entityResults ?? {}) as EntityResults;
  const currentEntity =
    (latest && !latest.finishedAt) || snapshot.running
      ? (CIN7_SCHEDULED_SYNC_ENTITY_ORDER.find((entity) => !(entity in entityResults)) ?? null)
      : null;

  const liveRuns = await prisma.cin7SyncRun.findMany({
    where: { ownerUserId: { in: ownerIds } },
    orderBy: { updatedAt: 'desc' },
    select: {
      entityType: true,
      status: true,
      recordsProcessed: true,
      updatedAt: true,
    },
  });
  const seen = new Set<string>();
  const live_entities = liveRuns
    .filter((run) => {
      if (seen.has(run.entityType)) return false;
      seen.add(run.entityType);
      return true;
    })
    .map((run) => ({
      entity: run.entityType,
      status: run.status,
      records: run.recordsProcessed,
      updated_at: run.updatedAt.toISOString(),
    }));

  const running =
    snapshot.running ||
    (latest != null && latest.finishedAt == null && latest.overallStatus === 'running');

  const fireAt = snapshot.nextFireAt;

  return NextResponse.json({
    source: 'server',
    schedule: {
      raw: '21:00',
      kind: 'daily',
      time_zone: 'Australia/Sydney',
    },
    next_fire_at: fireAt ? fireAt.toISOString() : null,
    countdown: fireAt && !running ? formatCountdownUntil(fireAt) : null,
    running,
    current_entity: currentEntity,
    unattended_owner_is_this_account: true,
    armed: fireAt != null,
    live_entities,
    last_run: latest
      ? {
          id: latest.id,
          started_at: latest.startedAt.toISOString(),
          finished_at: latest.finishedAt?.toISOString() ?? null,
          overall_status: latest.overallStatus,
          consecutive_complete_count: latest.consecutiveCompleteCount,
          entity_results: entityResults,
        }
      : null,
    note: running
      ? 'Server sync is running entity-by-entity. This page updates as each entity finishes.'
      : `Scheduled sync: ${CIN7_SYNC_SCHEDULE_LABEL}.`,
  });
}
