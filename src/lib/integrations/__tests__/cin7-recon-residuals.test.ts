import { describe, expect, it } from 'vitest';
import {
  b1ResidualsToCsv,
  buildB1ResidualRecords,
  emptyB1Tally,
  explainB1Residual,
  tallyB1Residuals,
} from '../cin7-recon-residuals';

describe('explainB1Residual', () => {
  it('explains a missing product as in the Cin7 snapshot but not Optix', () => {
    const text = explainB1Residual({
      entityType: 'products',
      reason: 'missing_in_optix',
      cin7Id: 'SKU-1',
      label: 'Widget',
    });
    expect(text).toContain('Widget');
    expect(text).toContain('SKU-1');
    expect(text).toContain('no matching Optix product');
  });

  it('explains extra customers as possible unlinked legacy rows', () => {
    const text = explainB1Residual({
      entityType: 'customers',
      reason: 'extra_in_optix',
      cin7Id: 'legacy-1',
      label: 'Old Co',
    });
    expect(text).toContain('unlinked legacy');
    expect(text).toContain('Old Co');
  });

  it('explains a missing tax code by code key', () => {
    const text = explainB1Residual({
      entityType: 'tax-codes',
      reason: 'missing_in_optix',
      cin7Id: 'GST',
      label: 'GST',
    });
    expect(text).toContain('tax-code');
    expect(text).toContain('GST');
  });
});

describe('buildB1ResidualRecords', () => {
  it('keeps only products, customers, suppliers and tax-codes missing/extra', () => {
    const items = buildB1ResidualRecords([
      { entityType: 'products', reason: 'missing_in_optix', cin7Id: 'A', label: 'A' },
      { entityType: 'customers', reason: 'missing_in_optix', cin7Id: 'c1', label: 'C1' },
      { entityType: 'customers', reason: 'extra_in_optix', cin7Id: 'c2', label: 'C2' },
      { entityType: 'suppliers', reason: 'missing_in_optix', cin7Id: 's1', label: 'S1' },
      { entityType: 'suppliers', reason: 'extra_in_optix', cin7Id: 's2', label: 'S2' },
      { entityType: 'tax-codes', reason: 'missing_in_optix', cin7Id: 'GST', label: 'GST' },
      { entityType: 'stock-levels', reason: 'missing_in_optix', cin7Id: 'b:sku', label: 'sku' },
      { entityType: 'products', reason: 'field_mismatch', cin7Id: 'B', label: 'B' },
    ]);

    expect(items).toHaveLength(6);
    expect(items.every((row) => row.explanation.length > 0)).toBe(true);
    expect(items.some((row) => row.entity_type === ('stock-levels' as never))).toBe(false);

    const counts = tallyB1Residuals(items);
    expect(counts).toEqual({
      products: { missing: 1, extra: 0 },
      customers: { missing: 1, extra: 1 },
      suppliers: { missing: 1, extra: 1 },
      'tax-codes': { missing: 1, extra: 0 },
    });
  });

  it('starts from an empty tally', () => {
    expect(emptyB1Tally().products).toEqual({ missing: 0, extra: 0 });
  });

  it('exports CSV with an explanation column', () => {
    const csv = b1ResidualsToCsv([
      {
        entity_type: 'products',
        cin7_id: 'SKU,1',
        label: 'Name "x"',
        reason: 'missing_in_optix',
        explanation: 'In Cin7, not Optix',
      },
    ]);
    expect(csv.startsWith('entity_type,cin7_id,label,reason,explanation')).toBe(true);
    expect(csv).toContain('""x""');
    expect(csv).toContain('SKU,1');
  });
});
