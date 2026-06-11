/**
 * Unit tests for the debtor ageing library.
 *
 * Tests use relative imports (vitest has no @/ alias configured by default, but
 * vitest.config.ts in this repo does define @/ → src/, so either works.
 * We use relative paths to match existing patterns in transfer-cancel-service.test.ts.)
 *
 * Coverage:
 *  1. computeDueDate — NET vs EOM including edge cases (month boundaries)
 *  2. bucketForDaysPastDue — boundary cases at 0, 1, 30, 31, 60, 61, 90, 91
 *  3. computeAgeingBuckets — correct bucketing, outstanding=0 exclusion, EOM dates
 *  4. buildCustomerAgeingLedger — grouping, sort order, empty input
 */
import { describe, it, expect } from 'vitest';
import {
  computeDueDate,
  bucketForDaysPastDue,
  computeAgeingBuckets,
  buildCustomerAgeingLedger,
  type InvoiceForAgeing,
  type InvoiceForAgeingWithCustomer,
} from '../debtor-ageing';

// ─── computeDueDate ─────────────────────────────────────────────────────────

describe('computeDueDate', () => {
  it('NET: adds days directly to invoice date', () => {
    const invoiceDate = new Date('2026-06-01T00:00:00Z');
    const result = computeDueDate(invoiceDate, 'NET', 30);
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('NET: 0 days returns invoice date itself', () => {
    const invoiceDate = new Date('2026-01-15T00:00:00Z');
    expect(computeDueDate(invoiceDate, 'NET', 0).toISOString().slice(0, 10)).toBe('2026-01-15');
  });

  it('EOM: end-of-month Jan (31 days) + 30 days = Mar 2', () => {
    // Jan 31 + 30 = Mar 2 (non-leap)
    const invoiceDate = new Date('2026-01-10T00:00:00Z');
    const result = computeDueDate(invoiceDate, 'EOM', 30);
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-02');
  });

  it('EOM: end-of-month Feb (28 days, non-leap) + 30 = Mar 30', () => {
    const invoiceDate = new Date('2026-02-05T00:00:00Z');
    const result = computeDueDate(invoiceDate, 'EOM', 30);
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-30');
  });

  it('EOM: end-of-month Feb in leap year (29 days) + 0 = Feb 29', () => {
    const invoiceDate = new Date('2024-02-14T00:00:00Z');
    const result = computeDueDate(invoiceDate, 'EOM', 0);
    expect(result.toISOString().slice(0, 10)).toBe('2024-02-29');
  });

  it('EOM-30 AU standard: invoice in June → due Jul 30', () => {
    // End of June = Jun 30; +30 = Jul 30
    const invoiceDate = new Date('2026-06-11T00:00:00Z');
    const result = computeDueDate(invoiceDate, 'EOM', 30);
    expect(result.toISOString().slice(0, 10)).toBe('2026-07-30');
  });

  it('NET-30 vs EOM-30 differ for mid-month invoice', () => {
    const invoiceDate = new Date('2026-06-11T00:00:00Z');
    const net = computeDueDate(invoiceDate, 'NET', 30);
    const eom = computeDueDate(invoiceDate, 'EOM', 30);
    // NET: Jun 11 + 30 = Jul 11. EOM: Jun 30 + 30 = Jul 30.
    expect(net.toISOString().slice(0, 10)).toBe('2026-07-11');
    expect(eom.toISOString().slice(0, 10)).toBe('2026-07-30');
  });
});

// ─── bucketForDaysPastDue ────────────────────────────────────────────────────

describe('bucketForDaysPastDue', () => {
  it('0 days past due → current', () => expect(bucketForDaysPastDue(0)).toBe('current'));
  it('negative days (not yet due) → current', () => expect(bucketForDaysPastDue(-5)).toBe('current'));
  it('1 day past due → 1-30', () => expect(bucketForDaysPastDue(1)).toBe('1-30'));
  it('30 days past due → 1-30 (boundary)', () => expect(bucketForDaysPastDue(30)).toBe('1-30'));
  it('31 days past due → 31-60 (boundary)', () => expect(bucketForDaysPastDue(31)).toBe('31-60'));
  it('60 days past due → 31-60 (boundary)', () => expect(bucketForDaysPastDue(60)).toBe('31-60'));
  it('61 days past due → 61-90 (boundary)', () => expect(bucketForDaysPastDue(61)).toBe('61-90'));
  it('90 days past due → 61-90 (boundary)', () => expect(bucketForDaysPastDue(90)).toBe('61-90'));
  it('91 days past due → 90+', () => expect(bucketForDaysPastDue(91)).toBe('90+'));
  it('365 days past due → 90+', () => expect(bucketForDaysPastDue(365)).toBe('90+'));
});

// ─── computeAgeingBuckets ────────────────────────────────────────────────────

describe('computeAgeingBuckets', () => {
  const asOf = new Date('2026-06-11T00:00:00Z');

  function inv(dueIso: string, total: number, amountPaid: number): InvoiceForAgeing {
    return { id: `inv-${dueIso}`, dueDate: new Date(dueIso), total, amountPaid };
  }

  it('empty invoice list returns all-zero buckets', () => {
    const result = computeAgeingBuckets([], asOf);
    expect(result).toEqual({ current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 });
  });

  it('fully paid invoice (outstanding=0) is excluded', () => {
    const result = computeAgeingBuckets([inv('2026-05-01', 1000, 1000)], asOf);
    expect(result.total).toBe(0);
  });

  it('not-yet-due invoice lands in current', () => {
    const result = computeAgeingBuckets([inv('2026-06-30', 500, 0)], asOf);
    expect(result.current).toBe(500);
    expect(result.total).toBe(500);
  });

  it('1-day overdue invoice lands in 1-30', () => {
    // dueDate = Jun 10, asOf = Jun 11 → 1 day past due
    const result = computeAgeingBuckets([inv('2026-06-10', 200, 0)], asOf);
    expect(result['1-30']).toBe(200);
  });

  it('30-day overdue boundary is in 1-30', () => {
    // dueDate = May 12 (30 days before Jun 11)
    const result = computeAgeingBuckets([inv('2026-05-12', 100, 0)], asOf);
    expect(result['1-30']).toBe(100);
  });

  it('31-day overdue boundary is in 31-60', () => {
    // dueDate = May 11 (31 days before Jun 11)
    const result = computeAgeingBuckets([inv('2026-05-11', 100, 0)], asOf);
    expect(result['31-60']).toBe(100);
  });

  it('90-day overdue boundary is in 61-90', () => {
    // dueDate = Mar 13 (90 days before Jun 11)
    const result = computeAgeingBuckets([inv('2026-03-13', 750, 0)], asOf);
    expect(result['61-90']).toBe(750);
  });

  it('91-day overdue lands in 90+', () => {
    // dueDate = Mar 12 (91 days before Jun 11)
    const result = computeAgeingBuckets([inv('2026-03-12', 900, 100)], asOf);
    expect(result['90+']).toBe(800);
  });

  it('partial payments reduce outstanding correctly', () => {
    const result = computeAgeingBuckets([inv('2026-04-01', 1000, 400)], asOf);
    // Apr 1 → 71 days past due → 61-90
    expect(result['61-90']).toBe(600);
    expect(result.total).toBe(600);
  });

  it('multiple invoices spread across buckets', () => {
    const invoices: InvoiceForAgeing[] = [
      inv('2026-06-30', 100, 0),   // current
      inv('2026-06-01', 200, 50),  // 10 days past due → 1-30, outstanding 150
      inv('2026-03-01', 300, 0),   // 102 days → 90+
    ];
    const result = computeAgeingBuckets(invoices, asOf);
    expect(result.current).toBe(100);
    expect(result['1-30']).toBe(150);
    expect(result['90+']).toBe(300);
    expect(result.total).toBe(550);
  });

  it('totals are rounded to 2dp (floating point safety)', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    const invoices: InvoiceForAgeing[] = [
      inv('2026-06-01', 0.1, 0),
      inv('2026-06-01', 0.2, 0),
    ];
    const result = computeAgeingBuckets(invoices, asOf);
    expect(result['1-30']).toBe(0.3);
  });

  it('EOM-derived due date: EOM-30 for June invoice → Jul 30', () => {
    // Invoice date Jun 11, EOM terms → dueDate Jul 30
    // asOf Jul 31 = 1 day past due → 1-30
    const eomDueDate = '2026-07-30';
    const asOf2 = new Date('2026-07-31T00:00:00Z');
    const result = computeAgeingBuckets([inv(eomDueDate, 500, 0)], asOf2);
    expect(result['1-30']).toBe(500);
  });
});

// ─── buildCustomerAgeingLedger ───────────────────────────────────────────────

describe('buildCustomerAgeingLedger', () => {
  const asOf = new Date('2026-06-11T00:00:00Z');

  function custInv(
    customerId: string,
    companyName: string,
    dueIso: string,
    total: number,
    amountPaid = 0,
    creditLimitAUD: number | null = null
  ): InvoiceForAgeingWithCustomer {
    return {
      id: `${customerId}-${dueIso}`,
      customerId,
      companyName,
      email: `${customerId}@example.com`,
      dueDate: new Date(dueIso),
      total,
      amountPaid,
      creditLimitAUD,
    };
  }

  it('empty list returns empty array', () => {
    expect(buildCustomerAgeingLedger([], asOf)).toEqual([]);
  });

  it('groups invoices by customerId', () => {
    const invoices = [
      custInv('cust-a', 'Alpha Co', '2026-03-01', 500, 0),
      custInv('cust-a', 'Alpha Co', '2026-05-01', 300, 0),
      custInv('cust-b', 'Beta Ltd', '2026-06-01', 200, 0),
    ];
    const rows = buildCustomerAgeingLedger(invoices, asOf);
    expect(rows).toHaveLength(2);
    const alpha = rows.find((r) => r.customerId === 'cust-a');
    expect(alpha?.buckets.total).toBeCloseTo(800, 2); // 500 + 300
  });

  it('sorts by total outstanding descending (worst debtor first)', () => {
    const invoices = [
      custInv('cust-small', 'Small Co', '2026-03-01', 100, 0),
      custInv('cust-big', 'Big Corp', '2026-03-01', 9000, 0),
    ];
    const rows = buildCustomerAgeingLedger(invoices, asOf);
    expect(rows[0].customerId).toBe('cust-big');
    expect(rows[1].customerId).toBe('cust-small');
  });

  it('carries creditLimitAUD from the first invoice of each customer', () => {
    const invoices = [
      custInv('cust-limited', 'Limited Co', '2026-03-01', 500, 0, 10000),
    ];
    const rows = buildCustomerAgeingLedger(invoices, asOf);
    expect(rows[0].creditLimitAUD).toBe(10000);
  });

  it('null creditLimitAUD passes through (no limit)', () => {
    const invoices = [custInv('cust-open', 'Open Credit', '2026-03-01', 200, 0, null)];
    const rows = buildCustomerAgeingLedger(invoices, asOf);
    expect(rows[0].creditLimitAUD).toBeNull();
  });
});
