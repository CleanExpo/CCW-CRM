import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mapCoreProductRows, mapOmniProductRows } from './cin7-sync-persist';

describe('mapCoreProductRows — skip reporting (UNI-2253)', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('maps rows with a SKU and reports none skipped', () => {
    const result = mapCoreProductRows([
      { Sku: 'ABC-1', Name: 'Widget', Price: 10, Available: 5 },
      { Sku: 'ABC-2', Name: 'Gadget', SellPrice: 20, Available: 0 },
    ]);
    expect(result.rows).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({ sku: 'ABC-1', name: 'Widget', price: 10, stock: 5 });
  });

  it('skips rows with a missing/empty SKU and records them with a reason instead of dropping silently', () => {
    const result = mapCoreProductRows([
      { Sku: 'HAS-SKU', Name: 'Kept' },
      { Sku: '', Name: 'No Sku Product' },
      { Name: 'Undefined Sku Product' },
      { Sku: '   ', Name: 'Whitespace Sku' },
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sku).toBe('HAS-SKU');
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped.every((s) => s.reason === 'missing_sku')).toBe(true);
    expect(result.skipped.map((s) => s.identifier)).toEqual([
      'No Sku Product',
      'Undefined Sku Product',
      'Whitespace Sku',
    ]);
  });

  it('logs a summary when rows are skipped', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mapCoreProductRows([{ Name: 'No Sku' }]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipped 1 product row'));
  });

  it('uses "(unnamed)" as the identifier when both SKU and Name are missing', () => {
    const result = mapCoreProductRows([{ Price: 5 }]);
    expect(result.skipped).toEqual([{ reason: 'missing_sku', identifier: '(unnamed)' }]);
  });
});

describe('mapOmniProductRows — skip reporting (UNI-2253)', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('maps valid rows and reports skipped ones separately', () => {
    const result = mapOmniProductRows([
      { sku: 'OMNI-1', name: 'Alpha', price: 3, stock: 7 },
      { sku: '', name: 'No Sku', price: 1, stock: 1 },
      { sku: '  ', name: 'Blank Sku', price: 2, stock: 2 },
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ sku: 'OMNI-1', name: 'Alpha', category: 'Cin7 Omni' });
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.every((s) => s.reason === 'missing_sku')).toBe(true);
  });
});
