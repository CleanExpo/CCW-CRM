import { logger } from '@/lib/logger';
import { getStripeWebhookSecret, handleVerifiedStripeEvent } from '@/lib/payments/stripe-webhook';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Stripe signed webhook — sole path for card/Stripe invoice "Paid" updates.
 * Configure endpoint: https://<host>/api/webhooks/stripe
 * Events: payment_intent.succeeded, checkout.session.completed, invoice.paid
 * Metadata required: invoice_id (CRM) and/or sales_invoice_id (fulfilment).
 */
export async function POST(request: NextRequest) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    // Do not log raw body or signature details.
    logger.warn('Stripe webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const outcome = await handleVerifiedStripeEvent(event);
    logger.info('Stripe webhook processed', {
      eventId: event.id,
      type: event.type,
      result: outcome.result,
    });
    return NextResponse.json({ received: true, ...outcome });
  } catch (error) {
    logger.error('Stripe webhook handler error', {
      eventId: event.id,
      type: event.type,
      detail: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
