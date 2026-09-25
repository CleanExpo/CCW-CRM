import { describe, expect, it } from 'vitest';
import { buildCostBasis, valuePositions } from '../cost-basis';

describe('buildCostBasis', () => {
  it('adds IMP-* line cost and header freight onto the product, not as a second stock SKU', () => {
    const basis = buildCostBasis({
      productPrices: [{ sku: 'WIDGET', price: 10 }],
      orders: [
        {
          shippingCost: 20,
          lines: [
            { sku: 'WIDGET', quantity: 2, unitCost: 100 },
            { sku: 'IMP-FREIGHT', quantity: 1, unitCost: 80 },
          ],
        },
      ],
    });
    expect(basis.landedPoLineTotal).toBe(80);
    expect(basis.headerFreightTotal).toBe(20);
    expect(basis.effectiveCostBySku.get('WIDGET')).toBe(150);
    expect(basis.landedCostAllocationUnread).toBe(true);
  });

  it('does not treat XFREIGHT as on-hand stock value of its own', () => {
    const basis = buildCostBasis({
      productPrices: [],
      orders: [
        {
          shippingCost: 0,
          lines: [{ sku: 'XFREIGHT-DSHIP', quantity: 1, unitCost: 19 }],
        },
      ],
    });
    expect(basis.effectiveCostBySku.has('XFREIGHT-DSHIP')).toBe(false);
    expect(basis.landedPoLineTotal).toBe(19);
  });

  it('values warehouse SOH on the effective cost', () => {
    const basis = buildCostBasis({
      productPrices: [{ sku: 'A', price: 5 }],
      orders: [{ shippingCost: 0, lines: [{ sku: 'A', quantity: 1, unitCost: 5 }] }],
    });
    const valued = valuePositions(
      [{ sku: 'A', warehouse: '3', warehouseName: 'QLD1', stockOnHand: 4 }],
      basis.effectiveCostBySku
    );
    expect(valued.warehouses[0]).toEqual({ warehouse: 'QLD1', value: 20 });
    expect(valued.qtyWithoutCost).toBe(0);
  });
});
