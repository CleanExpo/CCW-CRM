import { describe, expect, it } from 'vitest';
import { classifyPhase2Line, isLandedCostSku, USED_EQUIPMENT_SKU } from '../schedule-a';

describe('Schedule A Rev 1 line classification', () => {
  it('treats 700-MISC negative qty as a trade-in, not an ordinary sale', () => {
    expect(
      classifyPhase2Line({ sku: USED_EQUIPMENT_SKU, quantity: -1, unitPrice: 22400 })
    ).toBe('trade_in');
  });

  it('keeps Aberford Holdings invoices as a revaluation population', () => {
    expect(
      classifyPhase2Line({
        sku: 'A-SKU',
        quantity: 1,
        unitPrice: 100,
        customerName: 'Aberford Holdings Pty Ltd',
      })
    ).toBe('aberford_revaluation');
  });

  it('reads landed cost from IMP-* and XFREIGHT-* lines', () => {
    expect(isLandedCostSku('IMP-FREIGHT')).toBe(true);
    expect(isLandedCostSku('XFREIGHT-DSHIP')).toBe(true);
    expect(isLandedCostSku('WIDGET')).toBe(false);
    expect(classifyPhase2Line({ sku: 'IMP-GST', quantity: 1, unitPrice: 10 })).toBe(
      'landed_cost_po_line'
    );
  });

  it('excludes zero-priced lines from the pricing-exception check (E6)', () => {
    expect(classifyPhase2Line({ sku: 'NA0701', quantity: 1, unitPrice: 0 })).toBe(
      'zero_price_excluded'
    );
  });
});
