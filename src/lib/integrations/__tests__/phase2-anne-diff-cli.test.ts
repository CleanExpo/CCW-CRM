import { describe, expect, it } from 'vitest';

import { parseAnneStockOnHand } from '../../../../scripts/lib/anne-soh-parse.mjs';
import {
  diffAnneVsOptix,
  filterDiffLines,
  parsePhase2AnneDiffCliArgs,
} from '../../../../scripts/lib/phase2-anne-diff.mjs';

describe('parsePhase2AnneDiffCliArgs', () => {
  it('requires email and anne path', () => {
    expect(() => parsePhase2AnneDiffCliArgs(['--email', 'a@b.co'])).toThrow(/--anne/i);
    expect(() => parsePhase2AnneDiffCliArgs(['--anne', './x.csv'])).toThrow(/--email/i);
  });

  it('accepts --out and --confirm-remote', () => {
    const parsed = parsePhase2AnneDiffCliArgs([
      '--email=User@Example.com',
      '--anne=/tmp/anne.csv',
      '--out=/tmp/diff.csv',
      '--confirm-remote',
    ]);
    expect(parsed.email).toBe('user@example.com');
    expect(parsed.annePath).toBe('/tmp/anne.csv');
    expect(parsed.outPath).toBe('/tmp/diff.csv');
    expect(parsed.confirmRemote).toBe(true);
  });
});

describe('parseAnneStockOnHand', () => {
  it('parses Cin7 multi-row header (SOH / Stock Qty block)', () => {
    const rows = [
      ['', '', '', '', '', 2026],
      ['', '', '', '', '', 'SOH', 'SOH'],
      ['Product', 'Product Code', 'Branch', 'Stock Qty', 'Stock Value', 'Stock Qty', 'Stock Value'],
      ['Widget', 'SKU-A', 'CCW - QLD1, QLD', 0, 0, 5, 0],
    ];
    const parsed = parseAnneStockOnHand(rows);
    expect(parsed.layout).toBe('long-cin7-soh');
    expect(parsed.companyTotal).toBe(5);
    expect(parsed.positions[0]).toEqual({ sku: 'SKU-A', branch: 'CCW - QLD1, QLD', stockOnHand: 5 });
  });

  it('parses long-format Stock On Hand rows', () => {
    const rows = [
      ['Style Code', 'Branch Name', 'Stock On Hand', 'Available'],
      ['SKU-A', 'CCW - QLD1, QLD', '10', '8'],
      ['SKU-B', 'CCW - VIC1, VIC', '0', '0'],
    ];
    const parsed = parseAnneStockOnHand(rows);
    expect(parsed.layout).toBe('long');
    expect(parsed.companyTotal).toBe(10);
    expect(parsed.positions).toHaveLength(2);
  });
});

describe('diffAnneVsOptix', () => {
  it('flags quantity mismatch and extra/missing', () => {
    const anne = [
      { sku: 'A', branch: 'CCW - QLD1, QLD', stockOnHand: 5 },
      { sku: 'B', branch: 'CCW - QLD1, QLD', stockOnHand: 1 },
    ];
    const optix = [
      {
        sku: 'A',
        cin7BranchId: 'QLD1',
        branchName: 'CCW - QLD1, QLD',
        stockOnHand: 3,
      },
      {
        sku: 'C',
        cin7BranchId: 'QLD1',
        branchName: 'CCW - QLD1, QLD',
        stockOnHand: 2,
      },
    ];
    const { lines, counts } = diffAnneVsOptix(anne, optix);
    expect(counts.quantityMismatch).toBe(1);
    expect(counts.missingInOptix).toBe(1);
    expect(counts.extraInOptix).toBe(1);
    const variances = filterDiffLines(lines, false);
    expect(variances.every((l) => l.classification !== 'match')).toBe(true);
  });
});
