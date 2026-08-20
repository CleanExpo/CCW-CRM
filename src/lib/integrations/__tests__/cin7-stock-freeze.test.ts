import { describe, expect, it } from 'vitest';

import {
  assessCin7StockFreeze,
  attachAnneExportToFreeze,
  hashStockKeyset,
  normalizeStockKeyset,
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
  it('stores Anne row count and total quantity on the freeze without changing the keyset', () => {
    const base = freeze();
    const result = attachAnneExportToFreeze(base, {
      row_count: 10362,
      total_quantity: 184_221,
      as_of: '2026-08-19T21:00:00.000Z',
      captured_by: 'Anne',
    });
    expect(result.keyset_sha256).toBe(base.keyset_sha256);
    expect(result.cin7_keys).toBe(base.cin7_keys);
    expect(result.anne_export_row_count).toBe(10362);
    expect(result.anne_export_total_quantity).toBe(184221);
    expect(result.anne_export_captured_by).toBe('Anne');
    expect(result.anne_export_as_of).toBe('2026-08-19T21:00:00.000Z');
  });

  it('rejects a non-positive row count', () => {
    expect(() =>
      attachAnneExportToFreeze(freeze(), {
        row_count: 0,
        total_quantity: 1,
        as_of: '2026-08-19T21:00:00.000Z',
        captured_by: 'Anne',
      })
    ).toThrow(/row count/i);
  });
});
