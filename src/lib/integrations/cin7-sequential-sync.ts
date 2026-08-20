/**
 * Sequential Cin7 walk used by the unattended scheduler.
 * Same entity order, restart/resume, and contact `full=` as the old browser runner.
 * Each entity is posted until complete — time-budget pauses do not stop the walk.
 */

import {
  CIN7_SCHEDULED_SYNC_ENTITY_ORDER,
  isCin7ScheduledContactEntity,
  shouldRestartCin7ScheduledEntity,
  type Cin7ScheduledSyncEntity,
} from '@/lib/integrations/cin7-scheduled-sync';
import { isCin7StockSyncEntity } from '@/lib/integrations/cin7-stock-walk-deletes';

export type Cin7ScheduledChunkResult = {
  status?: string;
  complete?: boolean;
  next_page?: number | null;
  failed_page?: number | null;
  records_processed?: number;
  last_committed_page?: number;
  sync_errors?: string[];
};

export type Cin7ScheduledEntityOutcome = {
  status: string;
  records: number;
  pages: number;
  failed_page: number | null;
  complete: boolean;
  resumed: boolean;
};

export type Cin7SequentialSyncDeps = {
  loadPriorStatus: (entity: Cin7ScheduledSyncEntity) => Promise<string | null>;
  postChunk: (
    entity: Cin7ScheduledSyncEntity,
    opts: { restart: boolean; full: boolean }
  ) => Promise<Cin7ScheduledChunkResult>;
  sleep: (ms: number) => Promise<void>;
  onEntityProgress?: (
    entity: Cin7ScheduledSyncEntity,
    outcome: Cin7ScheduledEntityOutcome
  ) => Promise<void> | void;
  /** Safety cap against a stuck loop. Not a time budget. */
  maxChunksPerEntity?: number;
};

/** Guardrail only — a healthy catalog finishes well below this. */
export const CIN7_SCHEDULED_SYNC_MAX_CHUNKS_PER_ENTITY = 50_000;
const MAX_CONSECUTIVE_PAGE_RETRIES = 3;
const MAX_CONSECUTIVE_POST_ERRORS = 5;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isComplete(data: Cin7ScheduledChunkResult): boolean {
  return data.complete === true || data.status === 'complete';
}

function failedOutcome(resumed: boolean, last?: Cin7ScheduledChunkResult): Cin7ScheduledEntityOutcome {
  return {
    status: last?.status ?? 'failed',
    records: last?.records_processed ?? 0,
    pages: last?.last_committed_page ?? 0,
    failed_page: last?.failed_page ?? null,
    complete: false,
    resumed,
  };
}

/**
 * Keep posting one entity until complete. Per-request time budgets only pause
 * a chunk; this loop continues until Cin7 reports the entity finished.
 */
export async function syncCin7ScheduledEntityUntilComplete(
  entity: Cin7ScheduledSyncEntity,
  deps: Cin7SequentialSyncDeps,
  priorStatus: string | null
): Promise<Cin7ScheduledEntityOutcome> {
  const forceFullCatalog = isCin7ScheduledContactEntity(entity) || isCin7StockSyncEntity(entity);
  const maxChunks = deps.maxChunksPerEntity ?? CIN7_SCHEDULED_SYNC_MAX_CHUNKS_PER_ENTITY;
  let restart = shouldRestartCin7ScheduledEntity(priorStatus);
  const resumed = !restart;
  let last: Cin7ScheduledChunkResult = {};
  let pageErrorRetries = 0;
  let postErrorRetries = 0;

  for (let chunk = 0; chunk < maxChunks; chunk += 1) {
    try {
      last = await deps.postChunk(entity, {
        restart,
        full: forceFullCatalog,
      });
      restart = false;
      postErrorRetries = 0;
    } catch (error) {
      postErrorRetries += 1;
      if (postErrorRetries >= MAX_CONSECUTIVE_POST_ERRORS) {
        throw error;
      }
      await deps.sleep(5_000 * postErrorRetries);
      continue;
    }

    if (isComplete(last)) {
      return toOutcome(last, true, resumed);
    }

    if (last.status === 'running') {
      await deps.sleep(20_000);
      continue;
    }

    if (last.status === 'failed' && last.next_page == null && last.failed_page == null) {
      return toOutcome(last, false, resumed);
    }

    if (last.failed_page != null && last.complete === false && last.next_page != null) {
      if (pageErrorRetries < MAX_CONSECUTIVE_PAGE_RETRIES) {
        pageErrorRetries += 1;
        const rateLimited = (last.sync_errors ?? []).some((e) => /429|rate-?limit/i.test(e));
        await deps.sleep(rateLimited ? 15_000 : 5_000 * pageErrorRetries);
        continue;
      }
      return toOutcome(last, false, resumed);
    }

    if (last.complete === false && last.next_page != null) {
      pageErrorRetries = 0;
      continue;
    }

    return toOutcome(last, false, resumed);
  }

  return toOutcome(last, isComplete(last), resumed);
}

function toOutcome(
  last: Cin7ScheduledChunkResult,
  complete: boolean,
  resumed: boolean
): Cin7ScheduledEntityOutcome {
  return {
    status: last.status ?? (complete ? 'complete' : 'failed'),
    records: last.records_processed ?? 0,
    pages: last.last_committed_page ?? 0,
    failed_page: last.failed_page ?? null,
    complete,
    resumed,
  };
}

export async function runCin7SequentialEntityWalk(deps: Cin7SequentialSyncDeps): Promise<{
  entityResults: Record<string, Cin7ScheduledEntityOutcome>;
  cin7AllComplete: boolean;
  order: readonly Cin7ScheduledSyncEntity[];
}> {
  const entityResults: Record<string, Cin7ScheduledEntityOutcome> = {};

  for (const entity of CIN7_SCHEDULED_SYNC_ENTITY_ORDER) {
    const prior = await deps.loadPriorStatus(entity);
    let outcome: Cin7ScheduledEntityOutcome;
    try {
      outcome = await syncCin7ScheduledEntityUntilComplete(entity, deps, prior);
    } catch (error) {
      console.error(
        `[cin7-sequential-sync] ${entity} failed`,
        error instanceof Error ? error.message : error
      );
      outcome = failedOutcome(!shouldRestartCin7ScheduledEntity(prior));
    }
    entityResults[entity] = outcome;
    await deps.onEntityProgress?.(entity, outcome);
  }

  const cin7AllComplete = CIN7_SCHEDULED_SYNC_ENTITY_ORDER.every(
    (entity) => entityResults[entity]?.complete === true
  );
  return { entityResults, cin7AllComplete, order: CIN7_SCHEDULED_SYNC_ENTITY_ORDER };
}

export function defaultScheduledSyncSleep(ms: number): Promise<void> {
  return sleepMs(ms);
}
