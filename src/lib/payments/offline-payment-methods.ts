/**
 * Offline / audited payment methods staff may record in the UI.
 * Card / Stripe payments must come from a verified Stripe webhook only.
 */

export const OFFLINE_PAYMENT_METHODS = [
  'cash',
  'check',
  'cheque',
  'bank_transfer',
  'eft',
  'other',
] as const;

export type OfflinePaymentMethod = (typeof OFFLINE_PAYMENT_METHODS)[number];

const CARD_LIKE = new Set(['credit_card', 'card', 'stripe', 'debit_card', 'visa', 'mastercard']);

export function isCardOrStripePaymentMethod(method: string): boolean {
  return CARD_LIKE.has(method.trim().toLowerCase());
}

export function isOfflinePaymentMethod(method: string): boolean {
  return (OFFLINE_PAYMENT_METHODS as readonly string[]).includes(method.trim().toLowerCase());
}

export function assertManualPaymentMethodAllowed(method: string):
  | {
      ok: true;
      method: string;
    }
  | { ok: false; detail: string } {
  const normalized = method.trim().toLowerCase() || 'other';
  if (isCardOrStripePaymentMethod(normalized)) {
    return {
      ok: false,
      detail:
        'Card payments must be confirmed by Stripe webhooks. Record cash, EFT, cheque, or bank transfer with a reference instead.',
    };
  }
  if (!isOfflinePaymentMethod(normalized)) {
    return {
      ok: false,
      detail: `Unsupported payment method "${method}". Use cash, cheque, bank_transfer, eft, or other.`,
    };
  }
  return { ok: true, method: normalized === 'cheque' ? 'check' : normalized };
}
