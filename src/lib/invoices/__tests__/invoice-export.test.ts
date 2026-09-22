import { describe, expect, it } from 'vitest';

import { invoicesToCsv } from '../invoice-export';

describe('invoicesToCsv', () => {
  it('quotes commas so a branch or name does not break the export', () => {
    const csv = invoicesToCsv([
      {
        invoice_number: 'INV-1',
        customer_name: 'Smith, Pty',
        invoice_date: '2026-09-22',
        status: 'draft',
        total: 10,
      },
    ]);
    expect(csv).toContain('"Smith, Pty"');
    expect(csv.split('\n')).toHaveLength(2);
  });
});
