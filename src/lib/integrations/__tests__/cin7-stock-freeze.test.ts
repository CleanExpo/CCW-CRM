import { describe, expect, it } from 'vitest';

import {
  assessCin7StockFreeze,
  attachAnneExportToFreeze,
  hashStockKeyset,
  normalizeStockKeyset,
  parseAnnePerBranch,
  type Cin7StockFreezeRecord,
} from '../cin7-stock-freeze';
import { diffStockKeysForPrune } from '../cin7-stock-prune';

function freeze(partial: Partial<Cin7StockFreezeRecord> = {}): Cin7StockFreezeRecord {
  return {
    procedure: 'D10',
    freeze_id: 'freeze-1',
    as_of: '2026-08-17T11:00:00.000Z',
    time_zone: 'Australia/Sydney',
    cin7_keys: 10007,
    keyset_sha256: 'abc123def456',
    truncated: false,
    complete: true,
    cin7_reported_total: 10007,
    anne_export_row_count: null,
    anne_export_total_quantity: null,
    anne_export_value: null,
    anne_export_nonzero_positions: null,
    anne_export_per_branch: null,
    anne_export_as_of: null,
    anne_export_captured_by: null,
    ...partial,
  };
}

describe('D10 stock keyset', () => {
  it('normalizes and hashes keys in an order-independent way', () => {
    const a = hashStockKeyset(['b:sku-2', 'a:sku-1', 'a:sku-1']);
    const b = hashStockKeyset(['a:sku-1', 'b:sku-2']);
    expect(normalizeStockKeyset(['b:sku-2', 'a:sku-1', 'a:sku-1'])).toEqual(['a:sku-1', 'b:sku-2']);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe('assessCin7StockFreeze', () => {
  it('keeps prune locked until a complete freeze exists', () => {
    const result = assessCin7StockFreeze(null);
    expect(result.prune_enabled).toBe(false);
    expect(result.reason).toMatch(/D10 freeze has not been captured/i);
  });

  it('rejects a truncated or incomplete freeze', () => {
    expect(assessCin7StockFreeze(freeze({ truncated: true, complete: false })).prune_enabled).toBe(
      false
    );
    expect(assessCin7StockFreeze(freeze({ cin7_keys: 0 })).prune_enabled).toBe(false);
  });

  it('unlocks prune against a complete named freeze, not identical live counts', () => {
    const result = assessCin7StockFreeze(freeze());
    expect(result.prune_enabled).toBe(true);
    expect(result.reason).toMatch(/D10 freeze freeze-1/);
    expect(result.reason).toMatch(/Measure Optix against this keyset/i);
  });
});

describe('diffStockKeysForPrune', () => {
  it('deletes Optix extras against the freeze keyset and never needs a live walk', () => {
    const cin7Keys = new Set(['br-1:sku-a', 'br-1:sku-b']);
    const optix = [
      { id: '1', cin7BranchId: 'br-1', sku: 'sku-a' },
      { id: '2', cin7BranchId: 'br-1', sku: 'sku-ghost' },
      { id: '3', cin7BranchId: 'br-2', sku: 'sku-b' },
    ];
    const diff = diffStockKeysForPrune(cin7Keys, optix);
    expect(diff.toDeleteIds).toEqual(['2', '3']);
    expect(diff.missing_in_optix).toBe(1);
    expect(diff.missing_keys).toEqual(['br-1:sku-b']);
    expect(diff.optix_before).toBe(3);
    expect(diff.cin7_keys).toBe(2);
  });
});

describe('Anne export corroboration', () => {
  const anneInput = {
    row_count: 10362,
    total_quantity: 97_307.06,
    value: 1_487_977.13,
    nonzero_positions: 4846,
    per_branch: [
      { branch: 'Brisbane', quantity: 40_000 },
      { branch: 'Sydney', quantity: 57_307.06 },
    ],
    as_of: '2026-08-19T21:00:00.000Z',
    captured_by: 'Anne',
  };

  it('stores value, non-zero positions and per-branch qty with the row count', () => {
    const base = freeze();
    const result = attachAnneExportToFreeze(base, anneInput);
    expect(result.keyset_sha256).toBe(base.keyset_sha256);
    expect(result.cin7_keys).toBe(base.cin7_keys);
    expect(result.anne_export_row_count).toBe(10362);
    expect(result.anne_export_total_quantity).toBe(97307.06);
    expect(result.anne_export_value).toBe(1487977.13);
    expect(result.anne_export_nonzero_positions).toBe(4846);
    expect(result.anne_export_per_branch).toEqual(anneInput.per_branch);
    expect(result.anne_export_captured_by).toBe('Anne');
    expect(result.anne_export_as_of).toBe('2026-08-19T21:00:00.000Z');
  });

  it('rejects a non-positive row count', () => {
    expect(() =>
      attachAnneExportToFreeze(freeze(), {
        ...anneInput,
        row_count: 0,
      })
    ).toThrow(/row count/i);
  });

  it('rejects a missing value, non-zero count or per-branch breakdown', () => {
    expect(() =>
      attachAnneExportToFreeze(freeze(), { ...anneInput, value: Number.NaN })
    ).toThrow(/value/i);
    expect(() =>
      attachAnneExportToFreeze(freeze(), { ...anneInput, nonzero_positions: 0 })
    ).toThrow(/non-zero/i);
    expect(() =>
      attachAnneExportToFreeze(freeze(), { ...anneInput, per_branch: [] })
    ).toThrow(/per-branch/i);
  });
});

describe('parseAnnePerBranch', () => {
  it('reads one Branch: quantity line per warehouse', () => {
    expect(parseAnnePerBranch('Brisbane: 40000\nSydney = 57307.06')).toEqual([
      { branch: 'Brisbane', quantity: 40000 },
      { branch: 'Sydney', quantity: 57307.06 },
    ]);
  });

  it('rejects an empty or malformed breakdown', () => {
    expect(() => parseAnnePerBranch('')).toThrow(/per-branch/i);
    expect(() => parseAnnePerBranch('Brisbane only')).toThrow(/Branch: quantity/i);
  });
});
