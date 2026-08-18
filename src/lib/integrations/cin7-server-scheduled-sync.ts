/**
 * Sequential Cin7 walk used by the server scheduler.
 * Posts the same sync APIs as the buttons.
 */

import { POST as postCin7SyncEntity } from '@/app/api/integrations/cin7/sync/[entityType]/route';
import { findAppUserById } from '@/lib/auth/app-user-repo';
import { signAccessToken } from '@/lib/auth/jwt-tokens';
import { CIN7_SCHEDULED_SYNC_LOCK, withPgAdvisoryLock } from '@/lib/db/advisory-lock';
import { prisma } from '@/lib/db/prisma';
import { persistImmutableReconSnapshot } from '@/lib/integrations/cin7-recon-snapshot-store';
import { buildCin7Reconciliation } from '@/lib/integrations/cin7-reconciliation';
import { getOrBuildReconciliation } from '@/lib/integrations/cin7-reconciliation-cache';
import {
  getCin7ProductionSlotAtOrBefore,
  isCin7NightlyLedgerLive,
} from '@/lib/integrations/cin7-scheduled-sync';
import {
  defaultScheduledSyncSleep,
  runCin7SequentialEntityWalk,
  type Cin7ScheduledChunkResult,
  type Cin7ScheduledEntityOutcome,
} from '@/lib/integrations/cin7-sequential-sync';
import {
  getCin7SchedulerSnapshot,
  setCin7ScheduledSyncRunning,
} from '@/lib/integrations/cin7-server-scheduler';
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';

export type Cin7ScheduledSyncJobResult = {
  skipped: boolean;
  skip_reason?: 'lock_held' | 'missing_owner' | 'already_ran' | 'already_running';
  cin7_complete?: boolean;
  consecutive_complete_count?: number;
  ledger_id?: string;
  entity_results?: Record<string, Cin7ScheduledEntityOutcome>;
  recon?: { blocked: boolean; error?: string };
};

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause.message : '';
  return cause ? `${error.message} (${cause})` : error.message;
}

async function postCin7SyncChunk(
  ownerUserId: string,
  entity: string,
  opts: { restart: boolean; full: boolean }
): Promise<Cin7ScheduledChunkResult> {
  const user = await findAppUserById(ownerUserId);
  if (!user) {
    throw new Error('Scheduled sync user was not found');
  }
  const token = await signAccessToken(user.id, user.email, user.isAdmin, user.role);
  const params = new URLSearchParams();
  if (opts.restart) params.set('restart', 'true');
  if (opts.full) params.set('full', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const request = new NextRequest(
    `http://127.0.0.1/api/integrations/cin7/sync/${encodeURIComponent(entity)}${qs}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const res = await postCin7SyncEntity(request, {
    params: Promise.resolve({ entityType: entity }),
  });
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Cin7 sync ${entity} returned ${contentType || 'non-JSON'} (${res.status})`);
  }
  const body = (await res.json().catch(() => ({}))) as Cin7ScheduledChunkResult;
  if (!res.ok) {
    throw new Error(`Cin7 sync ${entity} HTTP ${res.status}`);
  }
  return body;
}

async function refreshLiveRecon(
  ownerUserId: string
): Promise<{ blocked: boolean; error?: string }> {
  try {
    const result = await getOrBuildReconciliation(
      ownerUserId,
      () => buildCin7Reconciliation(ownerUserId),
      { force: true }
    );
    await persistImmutableReconSnapshot({
      ownerUserId,
      mode: 'live',
      snapshot: result.snapshot,
    });
    const blocked =
      Boolean(result.snapshot.acceptance_blocked) ||
      Boolean(result.snapshot.fetch_meta?.incomplete) ||
      (result.snapshot.fetch_meta?.errors?.length ?? 0) > 0;
    return { blocked };
  } catch (error) {
    return {
      blocked: true,
      error: error instanceof Error ? error.message : 'Live recon failed',
    };
  }
}

async function runWalk(ownerUserId: string): Promise<Cin7ScheduledSyncJobResult> {
  const startedAt = new Date();
  const prevLedger = await prisma.cin7NightlySyncLedger.findFirst({
    where: { ownerUserId },
    orderBy: { startedAt: 'desc' },
  });

  const ledger = await prisma.cin7NightlySyncLedger.create({
    data: {
      ownerUserId,
      startedAt,
      overallStatus: 'running',
      entityResults: {},
      consecutiveCompleteCount: prevLedger?.consecutiveCompleteCount ?? 0,
    },
  });

  const entityResultsAcc: Record<string, Cin7ScheduledEntityOutcome> = {};

  try {
    const walk = await runCin7SequentialEntityWalk({
      loadPriorStatus: async (entity) => {
        const existing = await prisma.cin7SyncRun.findFirst({
          where: { ownerUserId, entityType: entity },
          select: { status: true },
          orderBy: { updatedAt: 'desc' },
        });
        return existing?.status ?? null;
      },
      postChunk: (entity, opts) => postCin7SyncChunk(ownerUserId, entity, opts),
      sleep: defaultScheduledSyncSleep,
      onEntityProgress: async (entity, outcome) => {
        entityResultsAcc[entity] = outcome;
        await prisma.cin7NightlySyncLedger.update({
          where: { id: ledger.id },
          data: {
            entityResults: entityResultsAcc as unknown as Prisma.InputJsonValue,
          },
        });
        console.log(
          `[cin7-scheduled-sync] ${entity}: ${outcome.complete ? 'complete' : outcome.status}` +
            ` records=${outcome.records}`
        );
      },
    });

    const recon = await refreshLiveRecon(ownerUserId);
    const consecutiveCompleteCount = walk.cin7AllComplete
      ? (prevLedger?.consecutiveCompleteCount ?? 0) + 1
      : 0;

    await prisma.cin7NightlySyncLedger.update({
      where: { id: ledger.id },
      data: {
        finishedAt: new Date(),
        overallStatus: walk.cin7AllComplete ? 'complete' : 'failed',
        entityResults: walk.entityResults as unknown as Prisma.InputJsonValue,
        consecutiveCompleteCount,
      },
    });

    return {
      skipped: false,
      cin7_complete: walk.cin7AllComplete,
      consecutive_complete_count: consecutiveCompleteCount,
      ledger_id: ledger.id,
      entity_results: walk.entityResults,
      recon,
    };
  } catch (error) {
    await prisma.cin7NightlySyncLedger.update({
      where: { id: ledger.id },
      data: {
        finishedAt: new Date(),
        overallStatus: 'failed',
        entityResults: entityResultsAcc as unknown as Prisma.InputJsonValue,
        consecutiveCompleteCount: 0,
      },
    });
    throw error;
  }
}

async function resolveOwnerUserId(explicit?: string): Promise<string | null> {
  if (explicit?.trim()) return explicit.trim();
  const remembered = getCin7SchedulerSnapshot().actorUserId;
  if (remembered) return remembered;
  const row = await prisma.appUser.findFirst({
    where: { isActive: true },
    orderBy: [{ isAdmin: 'desc' }, { lastLoginAt: 'desc' }],
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function recoverStaleCin7NightlyLedgers(input?: {
  inProcessRunning?: boolean;
  now?: Date;
}): Promise<number> {
  if (input?.inProcessRunning) return 0;
  const now = input?.now ?? new Date();
  const open = await prisma.cin7NightlySyncLedger.findMany({
    where: { overallStatus: 'running', finishedAt: null },
    select: { id: true, ownerUserId: true, startedAt: true, overallStatus: true, finishedAt: true },
  });
  let closed = 0;
  for (const row of open) {
    const heartbeat = await prisma.cin7SyncRun.findFirst({
      where: { ownerUserId: row.ownerUserId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    if (
      isCin7NightlyLedgerLive({
        overallStatus: row.overallStatus,
        finishedAt: row.finishedAt,
        startedAt: row.startedAt,
        inProcessRunning: false,
        lastSyncRunUpdatedAt: heartbeat?.updatedAt ?? null,
        now,
      })
    ) {
      continue;
    }
    await prisma.cin7NightlySyncLedger.update({
      where: { id: row.id },
      data: {
        finishedAt: now,
        overallStatus: 'failed',
      },
    });
    closed += 1;
  }
  return closed;
}

export async function runCin7ScheduledSyncJob(options?: {
  ownerUserId?: string;
}): Promise<Cin7ScheduledSyncJobResult> {
  const ownerUserId = await resolveOwnerUserId(options?.ownerUserId);
  if (!ownerUserId) {
    console.log('[cin7-scheduled-sync] skipped: no active workspace user');
    setCin7ScheduledSyncRunning(false);
    return { skipped: true, skip_reason: 'missing_owner' };
  }

  await recoverStaleCin7NightlyLedgers({
    inProcessRunning: getCin7SchedulerSnapshot().running,
  });

  const locked = await withPgAdvisoryLock(CIN7_SCHEDULED_SYNC_LOCK, async () => {
    const slot = getCin7ProductionSlotAtOrBefore(new Date());
    const existing = await prisma.cin7NightlySyncLedger.findFirst({
      where: { ownerUserId, startedAt: { gte: slot } },
      orderBy: { startedAt: 'desc' },
    });
    if (existing?.overallStatus === 'complete' && existing.finishedAt) {
      console.log(
        `[cin7-scheduled-sync] skipped: tonight's 9:00 PM slot already completed ledger=${existing.id}`
      );
      return { skipped: true, skip_reason: 'already_ran' } satisfies Cin7ScheduledSyncJobResult;
    }

    console.log(`[cin7-scheduled-sync] started owner=${ownerUserId}`);
    setCin7ScheduledSyncRunning(true);
    try {
      const result = await runWalk(ownerUserId);
      console.log('[cin7-scheduled-sync] completed', JSON.stringify(result));
      return result;
    } catch (error) {
      console.error('[cin7-scheduled-sync] failed', describeError(error));
      throw error;
    } finally {
      setCin7ScheduledSyncRunning(false);
    }
  });

  if (!locked.acquired) {
    console.log('[cin7-scheduled-sync] skipped: another replica already holds the sync lock');
    return { skipped: true, skip_reason: 'lock_held' };
  }
  return locked.result;
}
