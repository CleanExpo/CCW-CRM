import { describe, expect, it } from 'vitest';
import { buildCostBasis, qld1HighestValueRows, valuePositions } from '../cost-basis';

describe('buildCostBasis', () => {
  it('uses Cin7 average landed cost and never RetailPrice', () => {
    const basis = buildCostBasis({
      products: [{ sku: 'WIDGET', cin7Cost: 40, cin7AverageLandedCost: 42 }],
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
    expect(basis.effectiveCostBySku.get('WIDGET')).toBe(42);
    expect(basis.sourceBySku.get('WIDGET')).toBe('cin7_average_landed_cost');
    expect(basis.landedPoLineTotal).toBe(80);
    expect(basis.headerFreightTotal).toBe(20);
  });

  it('does not treat a sell price as a cost when Cin7 cost is missing', () => {
    const basis = buildCostBasis({
      products: [{ sku: 'RETAIL-ONLY', cin7Cost: null, cin7AverageLandedCost: null }],
      orders: [],
    });
    expect(basis.effectiveCostBySku.has('RETAIL-ONLY')).toBe(false);
  });

  it('does not treat XFREIGHT as on-hand stock value of its own', () => {
    const basis = buildCostBasis({
      products: [],
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

  it('values warehouse SOH on Cin7 cost and ranks QLD1', () => {
    const basis = buildCostBasis({
      products: [{ sku: 'A', cin7Cost: 5, cin7AverageLandedCost: null }],
      orders: [],
    });
    const valued = valuePositions(
      [{ sku: 'A', warehouse: '3', warehouseName: 'CCW - QLD1, QLD', stockOnHand: 4 }],
      basis.effectiveCostBySku
    );
    expect(valued.warehouses[0]).toEqual({ warehouse: 'CCW - QLD1, QLD', value: 20 });
    const rows = qld1HighestValueRows(
      [{ sku: 'A', warehouse: '3', warehouseName: 'CCW - QLD1, QLD', stockOnHand: 4 }],
      basis
    );
    expect(rows[0]).toMatchObject({ sku: 'A', source: 'cin7_cost', unitCost: 5, value: 20 });
  });
});
