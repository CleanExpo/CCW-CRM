import {
  applyStripeInvoicePayment,
  type StripePaymentApplyResult,
} from '@/lib/payments/apply-stripe-invoice-payment';
import Stripe from 'stripe';

function formatApplyResult(applied: StripePaymentApplyResult): string {
  if (applied.status === 'applied') return `applied:${applied.kind}:${applied.id}`;
  if (applied.status === 'duplicate') return 'duplicate';
  if (applied.status === 'not_found') return `not_found:${applied.reason}`;
  return `ignored:${applied.reason}`;
}

export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  // Use account default API version from the Stripe dashboard / SDK.
  return new Stripe(key);
}

export function getStripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret || null;
}

function meta(obj: { metadata?: Stripe.Metadata | null } | null | undefined): Stripe.Metadata {
  return obj?.metadata ?? {};
}

function readInvoiceIds(metadata: Stripe.Metadata): {
  invoiceId: string | null;
  salesInvoiceId: string | null;
} {
  const invoiceId = metadata.invoice_id?.trim() || metadata.optix_invoice_id?.trim() || null;
  const salesInvoiceId =
    metadata.sales_invoice_id?.trim() || metadata.optix_sales_invoice_id?.trim() || null;
  return { invoiceId, salesInvoiceId };
}

/**
 * Handle a verified Stripe event. Returns a short machine status for logging.
 */
export async function handleVerifiedStripeEvent(event: Stripe.Event): Promise<{
  handled: boolean;
  result: string;
}> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const { invoiceId, salesInvoiceId } = readInvoiceIds(meta(pi));
      const applied = await applyStripeInvoicePayment({
        stripeEventId: event.id,
        amount: (pi.amount_received || pi.amount) / 100,
        currency: pi.currency,
        paidAt: new Date((pi.created || Math.floor(Date.now() / 1000)) * 1000),
        paymentIntentId: pi.id,
        invoiceId,
        salesInvoiceId,
      });
      return { handled: true, result: formatApplyResult(applied) };
    }
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status && session.payment_status !== 'paid') {
        return { handled: true, result: `ignored:checkout_${session.payment_status}` };
      }
      const { invoiceId, salesInvoiceId } = readInvoiceIds(meta(session));
      const amountTotal = session.amount_total ?? 0;
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      const applied = await applyStripeInvoicePayment({
        stripeEventId: event.id,
        amount: amountTotal / 100,
        currency: session.currency ?? 'aud',
        paidAt: new Date(),
        paymentIntentId,
        invoiceId,
        salesInvoiceId,
      });
      return { handled: true, result: formatApplyResult(applied) };
    }
    case 'invoice.paid': {
      // SaaS Stripe Invoice object — only apply when Optix metadata is present.
      const inv = event.data.object as Stripe.Invoice;
      const { invoiceId, salesInvoiceId } = readInvoiceIds(meta(inv));
      if (!invoiceId && !salesInvoiceId) {
        return { handled: true, result: 'ignored:saas_invoice_no_optix_metadata' };
      }
      const applied = await applyStripeInvoicePayment({
        stripeEventId: event.id,
        amount: (inv.amount_paid ?? 0) / 100,
        currency: inv.currency,
        paidAt: new Date(),
        paymentIntentId: null,
        invoiceId,
        salesInvoiceId,
      });
      return { handled: true, result: formatApplyResult(applied) };
    }
    default:
      return { handled: false, result: `unhandled:${event.type}` };
  }
}
