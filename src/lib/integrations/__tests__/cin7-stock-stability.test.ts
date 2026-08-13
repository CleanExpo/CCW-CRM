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

describe('assessCin7StockStability', () => {
  it('requires three consecutive complete acceptance runs', () => {
    const result = assessCin7StockStability([run({ id: 'a', stock_cin7: 9805 })]);
    expect(result.stable).toBe(false);
    expect(result.required).toBe(CIN7_STOCK_STABILITY_RUNS_REQUIRED);
    expect(result.observed).toBe(1);
    expect(result.reason).toMatch(/Need 3 consecutive/);
  });

  it('is stable when the last three Cin7 counts match and are complete', () => {
    const result = assessCin7StockStability([
      run({ id: 'c', stock_cin7: 9805 }),
      run({ id: 'b', stock_cin7: 9805 }),
      run({ id: 'a', stock_cin7: 9805 }),
    ]);
    expect(result.stable).toBe(true);
    expect(result.cin7_counts).toEqual([9805, 9805, 9805]);
  });

  it('is not stable when Cin7 counts move between runs', () => {
    const result = assessCin7StockStability([
      run({ id: 'c', stock_cin7: 9805 }),
      run({ id: 'b', stock_cin7: 10542 }),
      run({ id: 'a', stock_cin7: 10534 }),
    ]);
    expect(result.stable).toBe(false);
    expect(result.reason).toMatch(/not identical/);
  });

  it('rejects a truncated run even if the count matches', () => {
    const result = assessCin7StockStability([
      run({ id: 'c', stock_cin7: 9805, truncated: true, complete: false }),
      run({ id: 'b', stock_cin7: 9805 }),
      run({ id: 'a', stock_cin7: 9805 }),
    ]);
    expect(result.stable).toBe(false);
    expect(result.reason).toMatch(/truncated or incomplete/);
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
