import { describe, expect, it } from 'vitest';
import {
  buildInvoiceSuggestion,
  confidenceBand,
  pickBestSuggestion,
} from '../matching-engine';

describe('bank reconciliation matching engine', () => {
  const feed = {
    id: 'feed-1',
    transaction_date: new Date('2026-05-15'),
    description: 'Payment INV-1001 Steamatic Brisbane',
    reference: 'INV-1001',
    credit: 1200,
    debit: null,
  };

  it('scores invoice match when amount and reference align', () => {
    const suggestion = buildInvoiceSuggestion(feed, {
      id: 'inv-1',
      invoiceNumber: 'INV-1001',
      total: 1200,
      amountPaid: 0,
      dueDate: new Date('2026-05-14'),
      invoiceDate: new Date('2026-05-01'),
      customer: { companyName: 'Steamatic Brisbane', contactName: null },
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion!.confidence).toBeGreaterThanOrEqual(80);
    expect(confidenceBand(suggestion!.confidence)).toBe('auto');
  });

  it('returns null when confidence is below threshold', () => {
    const suggestion = buildInvoiceSuggestion(
      { ...feed, credit: 50, reference: 'misc', description: 'unknown' },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-9999',
        total: 1200,
        amountPaid: 0,
        dueDate: new Date('2026-01-01'),
        invoiceDate: new Date('2026-01-01'),
        customer: { companyName: 'Other Co', contactName: null },
      }
    );
    expect(suggestion).toBeNull();
  });

  it('picks highest confidence suggestion', () => {
    const best = pickBestSuggestion([
      {
        target_type: 'invoice',
        target_id: 'a',
        label: 'A',
        amount: 100,
        date: feed.transaction_date.toISOString(),
        confidence: 72,
        match_reasons: [],
        suggested_action: 'match_invoice',
      },
      {
        target_type: 'invoice',
        target_id: 'b',
        label: 'B',
        amount: 100,
        date: feed.transaction_date.toISOString(),
        confidence: 96,
        match_reasons: [],
        suggested_action: 'match_invoice',
      },
    ]);
    expect(best?.target_id).toBe('b');
    expect(confidenceBand(best!.confidence)).toBe('auto');
  });
});
