import { describe, expect, it } from 'vitest';

import {
  assessStockWalkDeletes,
  mergeStockWalkKeys,
  STOCK_WALK_HIGH_WATER_RATIO,
} from '../cin7-stock-walk-deletes';
import { decideCin7SyncMode, entitySupportsModifiedSince } from '../cin7-sync-incremental';

describe('assessStockWalkDeletes', () => {
  const completeFull = {
    walkKind: 'full' as const,
    complete: true,
    truncated: false,
    syncErrors: [] as string[],
    reportedTotal: 10_362,
    keysFetched: 10_362,
    priorCompleteFullKeys: 10_393,
  };

  it('allows deletes only after a complete full walk that fetched the Cin7 Total', () => {
    const result = assessStockWalkDeletes(completeFull);
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/complete full walk/i);
  });

  it('refuses deletes on incremental walks', () => {
    const result = assessStockWalkDeletes({ ...completeFull, walkKind: 'incremental' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/incremental/i);
  });

  it('refuses deletes when the walk is incomplete', () => {
    const result = assessStockWalkDeletes({ ...completeFull, complete: false });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/incomplete/i);
  });

  it('refuses deletes when the catalog is truncated', () => {
    const result = assessStockWalkDeletes({
      ...completeFull,
      truncated: true,
      keysFetched: 4_000,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/truncated/i);
  });

  it('refuses deletes when the walk retained a 429 or other error', () => {
    const result = assessStockWalkDeletes({
      ...completeFull,
      syncErrors: ['Page 12: HTTP 429'],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/error/i);
  });

  it('refuses deletes when Total is present but fewer keys were fetched', () => {
    const result = assessStockWalkDeletes({
      ...completeFull,
      reportedTotal: 10_362,
      keysFetched: 8_000,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Total/i);
  });

  it('refuses deletes when Total is missing and the keyset is short of the last complete full walk', () => {
    const result = assessStockWalkDeletes({
      ...completeFull,
      reportedTotal: null,
      keysFetched: 5_000,
      priorCompleteFullKeys: 10_393,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/short/i);
    expect(STOCK_WALK_HIGH_WATER_RATIO).toBe(0.9);
  });

  it('allows a Total-less walk that stays within 90% of the last complete full key count', () => {
    const result = assessStockWalkDeletes({
      ...completeFull,
      reportedTotal: null,
      keysFetched: 10_362,
      priorCompleteFullKeys: 10_393,
    });
    expect(result.allowed).toBe(true);
  });

  it('allows a first complete full walk when Cin7 omits Total', () => {
    const result = assessStockWalkDeletes({
      ...completeFull,
      reportedTotal: null,
      priorCompleteFullKeys: null,
    });
    expect(result.allowed).toBe(true);
  });

  it('refuses an empty keyset', () => {
    const result = assessStockWalkDeletes({ ...completeFull, keysFetched: 0 });
    expect(result.allowed).toBe(false);
  });
});

describe('mergeStockWalkKeys', () => {
  it('accumulates unique branch:sku keys across chunked pages', () => {
    const first = mergeStockWalkKeys([], ['b1:sku-a', 'b1:sku-b']);
    const second = mergeStockWalkKeys(first, ['b1:sku-b', 'b2:sku-c']);
    expect(second).toEqual(['b1:sku-a', 'b1:sku-b', 'b2:sku-c']);
  });
});

describe('stock sync is never incremental', () => {
  it('does not advertise ModifiedDate for stock-levels or inventory', () => {
    expect(entitySupportsModifiedSince('stock-levels')).toBe(false);
    expect(entitySupportsModifiedSince('inventory')).toBe(false);
    expect(entitySupportsModifiedSince('products')).toBe(true);
  });

  it('restarts a completed stock sync as a full catalog walk', () => {
    const decided = decideCin7SyncMode({
      forceFull: false,
      forceRestart: true,
      status: 'complete',
      completedAt: new Date('2026-08-18T11:00:00Z'),
      entityType: 'stock-levels',
    });
    expect(decided.mode).toBe('full');
    expect(decided.modifiedSince).toBeNull();
  });

  it('still uses incremental mode for products after a complete sync', () => {
    const decided = decideCin7SyncMode({
      forceFull: false,
      forceRestart: true,
      status: 'complete',
      completedAt: new Date('2026-08-18T11:00:00Z'),
      entityType: 'products',
    });
    expect(decided.mode).toBe('incremental');
  });
});
