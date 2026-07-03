import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  customerNaturalKey,
  mapCoreProductRows,
  mapOmniProductRows,
  planNoEmailCustomerBatch,
} from './cin7-sync-persist';

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

describe('customerNaturalKey (UNI-2252)', () => {
  it('normalizes case, whitespace, and missing fields', () => {
    expect(customerNaturalKey(' Acme Pty Ltd ', ' 0400 111 222 ', ' Brisbane ')).toBe(
      customerNaturalKey('acme pty ltd', '0400 111 222', 'brisbane')
    );
    expect(customerNaturalKey('Acme', null, undefined)).toBe('acme||');
  });

  it('distinguishes customers that differ in any component', () => {
    expect(customerNaturalKey('Acme', '111', 'Brisbane')).not.toBe(
      customerNaturalKey('Acme', '222', 'Brisbane')
    );
    expect(customerNaturalKey('Acme', '111', 'Brisbane')).not.toBe(
      customerNaturalKey('Acme', '111', 'Sydney')
    );
  });
});

describe('planNoEmailCustomerBatch (UNI-2252)', () => {
  const row = (companyName: string, phone?: string, city?: string) => ({
    companyName,
    email: '',
    phone,
    city,
  });

  it('creates rows whose key is not in the DB and skips ones that are', () => {
    const plan = planNoEmailCustomerBatch(
      [row('Acme', '111', 'Brisbane'), row('NewCo', '333', 'Perth')],
      [{ companyName: 'Acme', phone: '111', city: 'Brisbane' }]
    );
    expect(plan.toCreate.map((r) => r.companyName)).toEqual(['NewCo']);
    expect(plan.matchedExisting).toBe(1);
    expect(plan.duplicatesInBatch).toBe(0);
  });

  it('is idempotent: re-running the same batch against its own output creates nothing', () => {
    const batch = [row('Acme', '111', 'Brisbane'), row('Beta', '222', 'Sydney')];
    const first = planNoEmailCustomerBatch(batch, []);
    expect(first.toCreate).toHaveLength(2);
    const second = planNoEmailCustomerBatch(
      batch,
      first.toCreate.map((r) => ({ companyName: r.companyName, phone: r.phone, city: r.city }))
    );
    expect(second.toCreate).toHaveLength(0);
    expect(second.matchedExisting).toBe(2);
  });

  it('matches case/whitespace variants of existing rows', () => {
    const plan = planNoEmailCustomerBatch(
      [row('  ACME  ', '111', 'BRISBANE')],
      [{ companyName: 'Acme', phone: '111', city: 'Brisbane' }]
    );
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.matchedExisting).toBe(1);
  });

  it('collapses repeated keys within one batch to a single create', () => {
    const plan = planNoEmailCustomerBatch(
      [row('Acme', '111', 'Brisbane'), row('Acme', '111', 'Brisbane')],
      []
    );
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.duplicatesInBatch).toBe(1);
  });

  it('tolerates pre-existing duplicates in the DB (first match wins, still no create)', () => {
    const dupe = { companyName: 'Acme', phone: '111', city: 'Brisbane' };
    const plan = planNoEmailCustomerBatch([row('Acme', '111', 'Brisbane')], [dupe, dupe, dupe]);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.matchedExisting).toBe(1);
  });

  it('does NOT merge customers that differ in phone or city (false-merge guard)', () => {
    const plan = planNoEmailCustomerBatch(
      [row('Acme', '222', 'Brisbane'), row('Acme', '111', 'Sydney')],
      [{ companyName: 'Acme', phone: '111', city: 'Brisbane' }]
    );
    expect(plan.toCreate).toHaveLength(2);
    expect(plan.matchedExisting).toBe(0);
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
