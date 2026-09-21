import { describe, expect, it } from 'vitest';
import { parseFitmentCsv, statusesVisibleTo, suggestFromOrderHistory } from '@/lib/fitment/rules';

describe('statusesVisibleTo', () => {
  it('customers see confirmed only', () => {
    expect(statusesVisibleTo('customer')).toEqual(['confirmed']);
  });
  it('staff see suggested and confirmed', () => {
    expect(statusesVisibleTo('staff')).toEqual(['suggested', 'confirmed']);
  });
});

describe('parseFitmentCsv', () => {
  it('parses rows, quoted fields and optional usage columns', () => {
    const csv = [
      'machine_sku,fit_sku,kind,usage_quantity,usage_per',
      'HD-500,FLT-1,consumable,1,250 hours',
      '"HD-500","NOZ, 25°",part,,',
    ].join('\n');
    const { rows, errors } = parseFitmentCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, machineSku: 'HD-500', fitSku: 'FLT-1', kind: 'consumable', usageQuantity: 1, usagePer: '250 hours' },
      { line: 3, machineSku: 'HD-500', fitSku: 'NOZ, 25°', kind: 'part', usageQuantity: null, usagePer: null },
    ]);
  });

  it('reports a missing column instead of guessing', () => {
    expect(parseFitmentCsv('machine_sku,fit_sku\nA,B').errors[0].message).toContain('kind');
  });

  it('reports each bad row by line and keeps the good ones', () => {
    const csv = [
      'machine_sku,fit_sku,kind,usage_quantity',
      'A,B,widget,',
      'A,A,part,',
      'A,C,part,-2',
      ',C,part,',
      'A,D,Accessory,',
      'A,D,part,',
    ].join('\r\n');
    const { rows, errors } = parseFitmentCsv(csv);
    expect(rows.map((r) => r.fitSku)).toEqual(['D']);
    expect(rows[0].kind).toBe('accessory');
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 7]);
  });

  it('treats an empty file as an error', () => {
    expect(parseFitmentCsv('\n\n').errors).toEqual([{ line: 1, message: 'File is empty' }]);
  });
});

describe('suggestFromOrderHistory', () => {
  const d = (n: number) => new Date(2026, 0, n);
  const machines = new Set(['M1', 'M2']);

  it('suggests products that enough machine buyers bought after the machine', () => {
    const orders = [
      { customerId: 'c1', createdAt: d(1), productIds: ['M1'] },
      { customerId: 'c1', createdAt: d(5), productIds: ['FILTER', 'SOAP'] },
      { customerId: 'c2', createdAt: d(2), productIds: ['M1'] },
      { customerId: 'c2', createdAt: d(9), productIds: ['FILTER'] },
      { customerId: 'c3', createdAt: d(3), productIds: ['M1'] },
    ];
    expect(suggestFromOrderHistory(orders, machines)).toEqual([
      { machineProductId: 'M1', fitProductId: 'FILTER', buyers: 2, machineBuyers: 3 },
    ]);
  });

  it('ignores purchases made before or with the machine, and never suggests another machine', () => {
    const orders = [
      { customerId: 'c1', createdAt: d(1), productIds: ['FILTER'] },
      { customerId: 'c1', createdAt: d(2), productIds: ['M1', 'HOSE'] },
      { customerId: 'c1', createdAt: d(3), productIds: ['M2'] },
      { customerId: 'c2', createdAt: d(1), productIds: ['FILTER'] },
      { customerId: 'c2', createdAt: d(2), productIds: ['M1', 'HOSE'] },
      { customerId: 'c2', createdAt: d(3), productIds: ['M2'] },
    ];
    const out = suggestFromOrderHistory(orders, machines);
    expect(out.find((s) => s.machineProductId === 'M1')).toBeUndefined();
  });

  it('one enthusiastic customer is not enough', () => {
    const orders = [
      { customerId: 'c1', createdAt: d(1), productIds: ['M1'] },
      { customerId: 'c1', createdAt: d(2), productIds: ['FILTER'] },
      { customerId: 'c1', createdAt: d(3), productIds: ['FILTER'] },
    ];
    expect(suggestFromOrderHistory(orders, machines)).toEqual([]);
  });
});
