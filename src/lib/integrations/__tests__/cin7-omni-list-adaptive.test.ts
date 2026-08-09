import { describe, expect, it } from 'vitest';

import { parseCin7OmniListResponse } from '@/lib/integrations/cin7-omni-list';
import {
  buildShortSyncIncompleteMessage,
  resolveAdaptiveEntityGapMs,
  resolveAdaptivePageGapMs,
  resolveCin7ExpectedCount,
} from '@/lib/integrations/cin7-sync-adaptive';

describe('parseCin7OmniListResponse', () => {
  it('handles bare arrays (no Total)', () => {
    const parsed = parseCin7OmniListResponse([{ Id: 1 }, { Id: 2 }]);
    expect(parsed.shape).toBe('array');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.total).toBeNull();
  });

  it('handles envelope with Total + Products', () => {
    const parsed = parseCin7OmniListResponse({
      Total: 500,
      Products: [{ Id: 1 }],
    });
    expect(parsed.shape).toBe('envelope');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.total).toBe(500);
  });

  it('handles string Total and unknown list keys', () => {
    const parsed = parseCin7OmniListResponse({
      total: '42',
      WeirdList: [{ a: 1 }, { a: 2 }],
    });
    expect(parsed.shape).toBe('envelope');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.total).toBe(42);
  });

  it('never throws on garbage', () => {
    expect(parseCin7OmniListResponse(null).rows).toEqual([]);
    expect(parseCin7OmniListResponse('nope').rows).toEqual([]);
    expect(parseCin7OmniListResponse(123).rows).toEqual([]);
    expect(parseCin7OmniListResponse({ Total: 9 }).rows).toEqual([]);
  });
});

describe('adaptive gaps', () => {
  it('skips gap on page 1 and single-page remaining', () => {
    expect(
      resolveAdaptivePageGapMs({
        configuredGapMs: 300,
        nextPage: 1,
        pageSize: 250,
        reportedTotal: 40,
        sourceRowsFetchedSoFar: 0,
      })
    ).toBe(0);

    expect(
      resolveAdaptivePageGapMs({
        configuredGapMs: 300,
        nextPage: 2,
        pageSize: 250,
        reportedTotal: 40,
        sourceRowsFetchedSoFar: 40,
      })
    ).toBe(0);
  });

  it('uses tiny gap when only a few pages remain', () => {
    expect(
      resolveAdaptivePageGapMs({
        configuredGapMs: 300,
        nextPage: 2,
        pageSize: 250,
        reportedTotal: 600,
        sourceRowsFetchedSoFar: 250,
      })
    ).toBe(50);
  });

  it('skips entity gap after a single-page previous entity', () => {
    expect(
      resolveAdaptiveEntityGapMs({
        configuredGapMs: 1500,
        previousEntitySourceRows: 12,
        pageSize: 250,
      })
    ).toBe(0);
  });
});

describe('short incompleteness message', () => {
  it('mentions short count and Continue', () => {
    const msg = buildShortSyncIncompleteMessage({ synced: 100, expected: 500 });
    expect(msg).toContain('Short of Cin7');
    expect(msg).toContain('Continue');
  });

  it('resolves expected as max of recon and live total', () => {
    expect(resolveCin7ExpectedCount(100, 120)).toBe(120);
    expect(resolveCin7ExpectedCount(null, 50)).toBe(50);
    expect(resolveCin7ExpectedCount(80, null)).toBe(80);
  });
});
