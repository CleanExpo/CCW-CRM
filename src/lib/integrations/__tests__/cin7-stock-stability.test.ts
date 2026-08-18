import { describe, expect, it } from 'vitest';
import {
  CIN7_STOCK_STABILITY_RUNS_REQUIRED,
  assessCin7StockStability,
  extractStockEvidence,
  type Cin7StockStabilityRun,
} from '../cin7-stock-stability';

function run(
  partial: Partial<Cin7StockStabilityRun> & Pick<Cin7StockStabilityRun, 'id' | 'stock_cin7'>
): Cin7StockStabilityRun {
  return {
    checked_at: '2026-08-13T08:20:52.000Z',
    status: 'complete',
    stock_optix: 13749,
    cin7_reported_total: partial.stock_cin7,
    truncated: false,
    complete: true,
    ...partial,
  };
}

describe('assessCin7StockStability (live drift, not a prune lock)', () => {
  it('notes when fewer than three complete acceptance runs exist', () => {
    const result = assessCin7StockStability([run({ id: 'a', stock_cin7: 9805 })]);
    expect(result.counts_identical).toBe(false);
    expect(result.required).toBe(CIN7_STOCK_STABILITY_RUNS_REQUIRED);
    expect(result.observed).toBe(1);
    expect(result.reason).toMatch(/live Cin7 catalog/i);
  });

  it('does not treat identical live counts as a prune unlock', () => {
    const result = assessCin7StockStability([
      run({ id: 'c', stock_cin7: 9805 }),
      run({ id: 'b', stock_cin7: 9805 }),
      run({ id: 'a', stock_cin7: 9805 }),
    ]);
    expect(result.counts_identical).toBe(true);
    expect(result.cin7_counts).toEqual([9805, 9805, 9805]);
    expect(result.reason).toMatch(/live Cin7 catalog still moves/i);
  });

  it('records live drift without calling it a sign-off failure', () => {
    const result = assessCin7StockStability([
      run({ id: 'c', stock_cin7: 10007 }),
      run({ id: 'b', stock_cin7: 9996 }),
      run({ id: 'a', stock_cin7: 9805 }),
    ]);
    expect(result.counts_identical).toBe(false);
    expect(result.cin7_counts).toEqual([10007, 9996, 9805]);
    expect(result.reason).toMatch(/live Cin7 catalog still moves/i);
  });
});

describe('extractStockEvidence', () => {
  it('prefers stock_evidence over reference counts', () => {
    const extracted = extractStockEvidence({
      cin7: { reference: { stock_levels: 10500 } } as never,
      optix: { reference: { stock_levels: 13749 } } as never,
      stock_evidence: {
        cin7_rows: 9805,
        cin7_reported_total: 10542,
        pages_fetched: 12,
        truncated: true,
        complete: false,
      },
    });
    expect(extracted.stock_cin7).toBe(9805);
    expect(extracted.cin7_reported_total).toBe(10542);
    expect(extracted.truncated).toBe(true);
    expect(extracted.stock_optix).toBe(13749);
  });
});
