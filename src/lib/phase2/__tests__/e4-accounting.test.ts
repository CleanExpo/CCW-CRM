import { describe, expect, it } from 'vitest';
import { classifyCogsEligibility, tallyCogsEligibility } from '../e4-accounting';

describe('E4 accounting-status condition', () => {
  it('requires dispatched date, invoice date and accounting status', () => {
    expect(classifyCogsEligibility({})).toBe('no_fully_dispatched_date');
    expect(
      classifyCogsEligibility({ FullyDispatchedDate: '2026-01-01', InvoiceDate: '2026-01-02' })
    ).toBe('no_accounting_status');
    expect(
      classifyCogsEligibility({
        FullyDispatchedDate: '2026-01-01',
        InvoiceDate: '2026-01-02',
        AccountingStatus: 'Posted',
      })
    ).toBe('ok');
  });

  it('tallies a page of sales', () => {
    const tally = tallyCogsEligibility([
      { FullyDispatchedDate: '2026-01-01', InvoiceDate: '2026-01-02', AccountingStatus: 'Posted' },
      {},
    ]);
    expect(tally.ok).toBe(1);
    expect(tally.no_fully_dispatched_date).toBe(1);
  });
});
