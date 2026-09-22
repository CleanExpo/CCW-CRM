import { describe, expect, it } from 'vitest';
import { compareArea1 } from '../area1';

describe('compareArea1', () => {
  it('does not treat an absent Cin7 row as missing when Optix is also zero', () => {
    const report = compareArea1({
      cin7: [],
      optix: [{ sku: 'A', warehouse: 'BNE', stockOnHand: 0 }],
      cin7Complete: true,
    });
    expect(report.counts.missing).toBe(0);
    expect(report.counts.extra).toBe(0);
    expect(report.clean).toBe(true);
  });

  it('flags Optix stock where Cin7 has no row as extra', () => {
    const report = compareArea1({
      cin7: [],
      optix: [{ sku: 'A', warehouse: 'BNE', warehouseName: 'Brisbane', stockOnHand: 4 }],
      cin7Complete: true,
    });
    expect(report.counts.extra).toBe(1);
    expect(report.sample[0]?.classification).toBe('extra_in_optix');
    expect(report.clean).toBe(false);
  });

  it('compares Stock On Hand and lists warehouse plus company totals', () => {
    const report = compareArea1({
      cin7: [
        { sku: 'A', warehouse: 'BNE', warehouseName: 'Brisbane', stockOnHand: 10 },
        { sku: 'B', warehouse: 'SYD', warehouseName: 'Sydney', stockOnHand: 5 },
      ],
      optix: [
        { sku: 'A', warehouse: 'BNE', warehouseName: 'Brisbane', stockOnHand: 8 },
        { sku: 'B', warehouse: 'SYD', warehouseName: 'Sydney', stockOnHand: 5 },
      ],
      cin7Complete: true,
    });
    expect(report.company.cin7).toBe(15);
    expect(report.company.optix).toBe(13);
    expect(report.counts.quantity_mismatch).toBe(1);
    expect(report.sample[0]).toMatchObject({
      sku: 'A',
      warehouse: 'Brisbane',
      difference: -2,
    });
    expect(report.warehouses).toHaveLength(2);
  });

  it('refuses to call an incomplete Cin7 pull clean', () => {
    const report = compareArea1({
      cin7: [{ sku: 'A', warehouse: 'BNE', stockOnHand: 1 }],
      optix: [{ sku: 'A', warehouse: 'BNE', stockOnHand: 1 }],
      cin7Complete: false,
    });
    expect(report.blocked).toBe(true);
    expect(report.clean).toBe(false);
    expect(report.blocked_reason).toMatch(/Incomplete Cin7 stock pull/);
  });
});
