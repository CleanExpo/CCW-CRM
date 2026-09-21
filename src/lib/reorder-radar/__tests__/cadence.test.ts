import { describe, expect, it } from 'vitest';
import {
  buildRadar,
  dailyDemandByProduct,
  radarLinesFromExtract,
  type PurchaseLine,
} from '@/lib/reorder-radar/cadence';
import type { ExtractInvoiceLine } from '@/lib/reporting/transaction-extract';
import { parseAsOf } from '@/lib/reorder-radar/as-of';

const line = (customerId: string, productId: string, date: string, quantity = 1): PurchaseLine => ({
  customerId,
  productId,
  date,
  quantity,
});

// Known 30-day cadence: 1 Jan, 31 Jan, 2 Mar -> next expected 1 Apr 2026.
const THIRTY_DAY = [
  line('c30', 'soap', '2026-01-01', 4),
  line('c30', 'soap', '2026-01-31', 4),
  line('c30', 'soap', '2026-03-02', 4),
];
const ONE_ORDER = [line('c1', 'soap', '2026-03-01', 10)];

describe('buildRadar — positive control', () => {
  it('a 30-day customer becomes due exactly 7 days before the expected date, not a day earlier', () => {
    expect(buildRadar(THIRTY_DAY, '2026-03-24').due).toHaveLength(0);
    const due = buildRadar(THIRTY_DAY, '2026-03-25').due;
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      customerId: 'c30',
      productId: 'soap',
      cadenceDays: 30,
      expectedDate: '2026-04-01',
      daysLate: -7,
    });
  });

  it('a customer with one order never appears on any list, on any day', () => {
    for (const asOf of ['2026-03-02', '2026-04-01', '2026-06-01', '2027-01-01']) {
      const r = buildRadar(ONE_ORDER, asOf);
      expect([...r.due, ...r.overdue, ...r.cadences].map((c) => c.customerId)).not.toContain('c1');
      expect(r.goneQuiet.map((q) => q.customerId)).not.toContain('c1');
    }
  });

  it('two purchases are not enough to trust a cadence', () => {
    expect(buildRadar(THIRTY_DAY.slice(0, 2), '2026-02-25').cadences).toHaveLength(0);
  });
});

describe('buildRadar — lists', () => {
  it('moves from due to overdue after the grace period, then drops off after three cadences', () => {
    // expected 1 Apr; grace = max(7, 25% of 30) = 8
    expect(buildRadar(THIRTY_DAY, '2026-04-09').due).toHaveLength(1);
    expect(buildRadar(THIRTY_DAY, '2026-04-10').overdue).toHaveLength(1);
    expect(buildRadar(THIRTY_DAY, '2026-04-10').due).toHaveLength(0);
    expect(buildRadar(THIRTY_DAY, '2026-07-01').overdue).toHaveLength(0);
  });

  it('flags a customer who has gone quiet', () => {
    const r = buildRadar(THIRTY_DAY, '2026-05-01');
    expect(r.goneQuiet).toEqual([
      { customerId: 'c30', purchases: 3, cadenceDays: 30, lastDate: '2026-03-02', daysSilent: 60 },
    ]);
    expect(buildRadar(THIRTY_DAY, '2026-04-15').goneQuiet).toHaveLength(0);
  });

  it('ignores lines after the as-of date, so a past day replays exactly', () => {
    const later = [...THIRTY_DAY, line('c30', 'soap', '2026-03-30', 4)];
    expect(buildRadar(later, '2026-03-25')).toEqual(buildRadar(THIRTY_DAY, '2026-03-25'));
  });

  it('uses the median gap, so one odd gap does not move the date', () => {
    const lines = [
      line('c', 'p', '2026-01-01'),
      line('c', 'p', '2026-01-31'),
      line('c', 'p', '2026-02-02'),
      line('c', 'p', '2026-03-04'),
    ];
    expect(buildRadar(lines, '2026-03-05').cadences[0].cadenceDays).toBe(30);
  });

  it('two lines on the same day count as one purchase', () => {
    const lines = [...THIRTY_DAY, line('c30', 'soap', '2026-03-02', 2)];
    const [c] = buildRadar(lines, '2026-03-25').cadences;
    expect(c.purchases).toBe(3);
    expect(c.avgQuantity).toBeCloseTo(14 / 3);
  });
});

describe('radarLinesFromExtract', () => {
  const x = (over: Partial<ExtractInvoiceLine>): ExtractInvoiceLine => ({
    kind: 'invoice_line',
    invoice_id: 'i',
    invoice_number: 'INV',
    customer_id: 'c',
    branch_name: null,
    product_id: 'p',
    sku: 'P',
    quantity: 1,
    unit_price: 1,
    line_total: 1,
    invoice_date: '2026-01-01',
    invoice_status: 'sent',
    ...over,
  });

  it('drops draft and cancelled invoices and lines without a product', () => {
    const out = radarLinesFromExtract([
      x({}),
      x({ invoice_status: 'draft' }),
      x({ invoice_status: 'cancelled' }),
      x({ product_id: null }),
    ]);
    expect(out).toEqual([{ customerId: 'c', productId: 'p', date: '2026-01-01', quantity: 1 }]);
  });
});

describe('dailyDemandByProduct', () => {
  it('sums average quantity per cadence day across customers', () => {
    const lines = [
      ...THIRTY_DAY,
      line('c2', 'soap', '2026-01-01', 10),
      line('c2', 'soap', '2026-01-11', 10),
      line('c2', 'soap', '2026-01-21', 10),
    ];
    const demand = dailyDemandByProduct(buildRadar(lines, '2026-03-25').cadences);
    expect(demand.get('soap')).toBeCloseTo(4 / 30 + 10 / 10);
  });
});

describe('parseAsOf', () => {
  it('accepts a real date and rejects anything else', () => {
    expect(parseAsOf('2026-03-25')).toBe('2026-03-25');
    expect(parseAsOf('2026-02-30')).toBeNull();
    expect(parseAsOf('25/03/2026')).toBeNull();
    expect(parseAsOf(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
