import { describe, expect, it } from 'vitest';
import { parseCdrCsv, validateCdrRows } from '../cdr-import';

describe('CDR CSV import', () => {
  it('parses standard bank export columns', () => {
    const csv = [
      'Date,Description,Reference,Credit,Debit,Balance',
      '15/05/2026,Customer payment INV-1001,INV-1001,1200.00,,5000.00',
      '16/05/2026,Bank fee,FEE,,15.00,4985.00',
    ].join('\n');

    const rows = parseCdrCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].credit).toBe(1200);
    expect(rows[1].debit).toBe(15);
  });

  it('filters rows without amounts', () => {
    const { valid, skipped } = validateCdrRows([
      { transaction_date: new Date().toISOString(), description: 'x', credit: null, debit: null },
      { transaction_date: new Date().toISOString(), description: 'y', credit: 10, debit: null },
    ]);
    expect(valid).toHaveLength(1);
    expect(skipped).toBe(1);
  });
});
