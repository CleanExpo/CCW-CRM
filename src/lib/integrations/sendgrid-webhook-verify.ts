import { createPublicKey, createVerify } from 'node:crypto';
import type { NextRequest } from 'next/server';

const SIGNATURE_HEADER = 'x-twilio-email-event-webhook-signature';
const TIMESTAMP_HEADER = 'x-twilio-email-event-webhook-timestamp';

/**
 * Verifies SendGrid signed event webhooks (ECDSA).
 * @see https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
export function verifySendGridEventWebhookSignature(
  publicKeyBase64: string,
  rawPayload: string,
  signatureHeader: string | null,
  timestampHeader: string | null
): boolean {
  if (!signatureHeader?.trim() || !timestampHeader?.trim() || !publicKeyBase64.trim()) {
    return false;
  }

  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyBase64.trim(), 'base64'),
      format: 'der',
      type: 'spki',
    });
    const signed = Buffer.from(`${timestampHeader.trim()}${rawPayload}`, 'utf8');
    const signature = Buffer.from(signatureHeader.trim(), 'base64');
    return createVerify('sha256').update(signed).verify({ key, dsaEncoding: 'ieee-p1363' }, signature);
  } catch {
    return false;
  }
}

export function getSendGridEventWebhookHeaders(request: NextRequest): {
  signature: string | null;
  timestamp: string | null;
} {
  return {
    signature: request.headers.get(SIGNATURE_HEADER),
    timestamp: request.headers.get(TIMESTAMP_HEADER),
  };
}

export function getSendGridEventWebhookPublicKey(): string | null {
  return (
    process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY?.trim() ||
    process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY?.trim() ||
    null
  );
}
