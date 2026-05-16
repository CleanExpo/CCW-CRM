import type { NextRequest } from 'next/server';
import {
  getSendGridEventWebhookHeaders,
  getSendGridEventWebhookPublicKey,
  verifySendGridEventWebhookSignature,
} from '@/lib/integrations/sendgrid-webhook-verify';

/**
 * Validates SendGrid webhook calls using a shared secret (query `token` or Authorization bearer).
 * Set SENDGRID_WEBHOOK_SECRET in the environment and configure the same value in SendGrid.
 */
export function verifySendGridWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.SENDGRID_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const urlToken = request.nextUrl.searchParams.get('token')?.trim();
  if (urlToken && urlToken === secret) return true;

  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  return false;
}

/**
 * Event webhooks: prefer ECDSA signature (production), fall back to shared secret.
 */
export function verifySendGridEventWebhook(request: NextRequest, rawBody: string): boolean {
  const publicKey = getSendGridEventWebhookPublicKey();
  if (publicKey) {
    const { signature, timestamp } = getSendGridEventWebhookHeaders(request);
    if (verifySendGridEventWebhookSignature(publicKey, rawBody, signature, timestamp)) {
      return true;
    }
  }
  return verifySendGridWebhookSecret(request);
}

/** Inbound parse: shared secret only (SendGrid Inbound Parse does not sign with ECDSA). */
export function verifySendGridInboundWebhook(request: NextRequest): boolean {
  return verifySendGridWebhookSecret(request);
}

export function getSendGridInboundOwnerUserId(): string | null {
  return (
    process.env.SENDGRID_INBOUND_OWNER_USER_ID?.trim() ||
    process.env.CRON_INTEGRATION_USER_ID?.trim() ||
    null
  );
}
