import {
  assertManualPaymentMethodAllowed,
  isCardOrStripePaymentMethod,
} from '@/lib/payments/offline-payment-methods';
import { describe, expect, it } from 'vitest';

describe('offline payment methods', () => {
  it('rejects card / stripe methods for manual entry', () => {
    expect(isCardOrStripePaymentMethod('credit_card')).toBe(true);
    expect(isCardOrStripePaymentMethod('card')).toBe(true);
    expect(assertManualPaymentMethodAllowed('credit_card').ok).toBe(false);
    expect(assertManualPaymentMethodAllowed('stripe').ok).toBe(false);
  });

  it('allows offline methods', () => {
    expect(assertManualPaymentMethodAllowed('bank_transfer')).toEqual({
      ok: true,
      method: 'bank_transfer',
    });
    expect(assertManualPaymentMethodAllowed('cheque')).toEqual({
      ok: true,
      method: 'check',
    });
    expect(assertManualPaymentMethodAllowed('cash').ok).toBe(true);
  });
});
