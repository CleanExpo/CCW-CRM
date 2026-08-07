import {
  buildProductFieldMismatchBreakdown,
  emptyProductFieldMismatchBreakdown,
  productFieldsMatch,
  type Cin7ProductCompareRow,
} from '@/lib/integrations/cin7-product-heal';
import { describe, expect, it } from 'vitest';

function row(partial: Partial<Cin7ProductCompareRow> & { sku: string }): Cin7ProductCompareRow {
  return {
    name: 'Widget',
    price: 10,
    stock: 5,
    visibility: 'Public',
    isActive: true,
    ...partial,
  };
}

describe('productFieldsMatch', () => {
  it('matches when all compared fields align', () => {
    const a = row({ sku: 'A1' });
    expect(productFieldsMatch(a, { ...a })).toBe(true);
  });

  it('ignores name/visibility case and trims whitespace', () => {
    expect(
      productFieldsMatch(
        row({ sku: 'A1', name: '  Widget  ', visibility: 'Public' }),
        row({ sku: 'A1', name: 'widget', visibility: ' public ' })
      )
    ).toBe(true);
  });

  it('allows price within 0.01', () => {
    expect(
      productFieldsMatch(row({ sku: 'A1', price: 10 }), row({ sku: 'A1', price: 10.009 }))
    ).toBe(true);
    expect(
      productFieldsMatch(row({ sku: 'A1', price: 10 }), row({ sku: 'A1', price: 10.02 }))
    ).toBe(false);
  });

  it('fails on stock / active / visibility diffs', () => {
    expect(productFieldsMatch(row({ sku: 'A1', stock: 5 }), row({ sku: 'A1', stock: 6 }))).toBe(
      false
    );
    expect(
      productFieldsMatch(row({ sku: 'A1', isActive: true }), row({ sku: 'A1', isActive: false }))
    ).toBe(false);
    expect(
      productFieldsMatch(
        row({ sku: 'A1', visibility: 'Public' }),
        row({ sku: 'A1', visibility: 'Private' })
      )
    ).toBe(false);
  });
});

describe('buildProductFieldMismatchBreakdown', () => {
  it('returns zeros when catalogs match', () => {
    const cin7 = new Map([['A1', row({ sku: 'A1' })]]);
    const optix = new Map([['A1', row({ sku: 'A1' })]]);
    expect(buildProductFieldMismatchBreakdown(cin7, optix)).toEqual({
      mismatchedSkus: 0,
      breakdown: emptyProductFieldMismatchBreakdown(),
    });
  });

  it('counts only matched SKUs and tallies each differing field', () => {
    const cin7 = new Map([
      [
        'A1',
        row({ sku: 'A1', name: 'New', price: 12, stock: 9, isActive: false, visibility: 'B2B' }),
      ],
      ['ONLY_CIN7', row({ sku: 'ONLY_CIN7' })],
    ]);
    const optix = new Map([
      [
        'A1',
        row({
          sku: 'A1',
          name: 'Old',
          price: 10,
          stock: 5,
          isActive: true,
          visibility: 'Public',
        }),
      ],
      ['ONLY_OPTIX', row({ sku: 'ONLY_OPTIX' })],
    ]);

    const result = buildProductFieldMismatchBreakdown(cin7, optix);
    expect(result.mismatchedSkus).toBe(1);
    expect(result.breakdown).toEqual({
      name: 1,
      price: 1,
      stock: 1,
      is_active: 1,
      visibility: 1,
    });
  });

  it('can attribute a single-field stock drift', () => {
    const cin7 = new Map([['A1', row({ sku: 'A1', stock: 8 })]]);
    const optix = new Map([['A1', row({ sku: 'A1', stock: 3 })]]);
    const result = buildProductFieldMismatchBreakdown(cin7, optix);
    expect(result.mismatchedSkus).toBe(1);
    expect(result.breakdown).toEqual({
      name: 0,
      price: 0,
      stock: 1,
      is_active: 0,
      visibility: 0,
    });
  });
});
