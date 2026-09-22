import { describe, expect, it } from 'vitest';

import { decideCin7SyncMode, floorSyncRecordCount } from '@/lib/integrations/cin7-sync-incremental';

/**
 * UNI-2108 Cin7 reliability notes — asserts existing helpers only.
 * Does not change sync, prune, or live Cin7 calls.
 */
describe('UNI-2108 Cin7 smoke contract (existing helpers)', () => {
  it('a completed re-sync stays incremental so a second pass is not a full wipe', () => {
    const first = decideCin7SyncMode({
      forceFull: false,
      forceRestart: false,
      status: 'complete',
      completedAt: new Date('2026-09-01T00:00:00Z'),
      optixCount: 100,
      expectedSourceCount: 100,
    });
    const second = decideCin7SyncMode({
      forceFull: false,
      forceRestart: false,
      status: 'complete',
      completedAt: new Date('2026-09-01T00:00:00Z'),
      optixCount: 100,
      expectedSourceCount: 100,
    });
    expect(first.mode).toBe('incremental');
    expect(second.mode).toBe(first.mode);
  });

  it('a second pass cannot report fewer rows than Optix already holds', () => {
    const first = floorSyncRecordCount({ optixCount: 80, thisRunProcessed: 80 });
    const second = floorSyncRecordCount({
      optixCount: 80,
      thisRunProcessed: 3,
      previousFloor: first,
    });
    expect(second).toBe(first);
  });
});
