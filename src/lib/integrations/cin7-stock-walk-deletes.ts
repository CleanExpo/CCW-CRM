/**
 * Decide whether a stock sync walk may delete Optix rows Cin7 stopped returning.
 * Deletes are never inferred from incremental, truncated, or error walks.
 */

import { normalizeStockKeyset } from '@/lib/integrations/cin7-stock-freeze';
import { resolveCin7SyncEntityAlias } from '@/lib/integrations/cin7-master-entities';

export const STOCK_WALK_HIGH_WATER_RATIO = 0.9;

export type StockWalkKind = 'full' | 'incremental';

export type StockWalkDeleteAssessment = {
  allowed: boolean;
  reason: string;
};

export function isCin7StockSyncEntity(entityType: string): boolean {
  return resolveCin7SyncEntityAlias(entityType) === 'stock-levels';
}

export function assessStockWalkDeletes(input: {
  walkKind: StockWalkKind;
  complete: boolean;
  truncated: boolean;
  syncErrors: string[];
  reportedTotal: number | null;
  keysFetched: number;
  priorCompleteFullKeys: number | null;
}): StockWalkDeleteAssessment {
  if (input.walkKind !== 'full') {
    return {
      allowed: false,
      reason: 'Stock deletes are not applied on incremental walks.',
    };
  }
  if (!input.complete) {
    return { allowed: false, reason: 'Stock deletes are not applied on an incomplete walk.' };
  }
  if (input.truncated) {
    return { allowed: false, reason: 'Stock deletes are not applied on a truncated catalog.' };
  }
  const errors = input.syncErrors.map((e) => e.trim()).filter(Boolean);
  if (errors.length > 0) {
    return {
      allowed: false,
      reason: `Stock deletes are not applied when the walk retained an error (${errors[0]}).`,
    };
  }
  if (input.keysFetched <= 0) {
    return { allowed: false, reason: 'Stock deletes are not applied on an empty keyset.' };
  }
  if (
    typeof input.reportedTotal === 'number' &&
    input.reportedTotal > 0 &&
    input.keysFetched < input.reportedTotal
  ) {
    return {
      allowed: false,
      reason: `Stock deletes are not applied: fetched ${input.keysFetched} of Cin7 Total ${input.reportedTotal}.`,
    };
  }
  if (
    input.reportedTotal == null &&
    typeof input.priorCompleteFullKeys === 'number' &&
    input.priorCompleteFullKeys > 0 &&
    input.keysFetched < Math.floor(input.priorCompleteFullKeys * STOCK_WALK_HIGH_WATER_RATIO)
  ) {
    return {
      allowed: false,
      reason: `Stock deletes are not applied: keyset ${input.keysFetched} is short of the last complete full walk (${input.priorCompleteFullKeys}).`,
    };
  }
  return {
    allowed: true,
    reason: `Complete full walk of ${input.keysFetched} Cin7 stock keys — Optix rows absent from this walk can be removed.`,
  };
}

export function mergeStockWalkKeys(
  existing: Iterable<string>,
  pageKeys: Iterable<string>
): string[] {
  return normalizeStockKeyset([...existing, ...pageKeys]);
}

export type StockWalkCheckpoint = {
  kind: StockWalkKind;
  keys: string[];
  priorCompleteFullKeys: number | null;
};

const SKIPPED_WALK_KEY = 'stock_walk';

export function readStockWalkCheckpoint(skipped: unknown): StockWalkCheckpoint | null {
  if (!skipped || typeof skipped !== 'object' || Array.isArray(skipped)) return null;
  const raw = (skipped as Record<string, unknown>)[SKIPPED_WALK_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const kind = (raw as { kind?: unknown }).kind;
  const keys = (raw as { keys?: unknown }).keys;
  if (kind !== 'full' && kind !== 'incremental') return null;
  if (!Array.isArray(keys)) return null;
  const prior = (raw as { priorCompleteFullKeys?: unknown }).priorCompleteFullKeys;
  return {
    kind,
    keys: normalizeStockKeyset(keys.filter((k): k is string => typeof k === 'string')),
    priorCompleteFullKeys:
      typeof prior === 'number' && Number.isFinite(prior) ? prior : null,
  };
}

export function writeStockWalkCheckpoint(
  skipped: Record<string, unknown> | null | undefined,
  walk: StockWalkCheckpoint
): Record<string, unknown> {
  return {
    ...(skipped ?? {}),
    [SKIPPED_WALK_KEY]: {
      kind: walk.kind,
      keys: normalizeStockKeyset(walk.keys),
      priorCompleteFullKeys: walk.priorCompleteFullKeys,
    },
  };
}
