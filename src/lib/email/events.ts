/**
 * Apply SendGrid delivery events to transactional receipts (UNI-2671 A3).
 *
 * The existing `applySendGridEvent` resolves events against `EmailMessage`,
 * which only exists for CRM conversation threads. Transactional mail — invites,
 * resets, booking confirmations — has no thread, so without this its bounces
 * landed nowhere and a hard-bounced invitation was indistinguishable from a
 * delivered one.
 *
 * Correlation is by the `receipt_id` custom arg the mailer attaches to every
 * send. SendGrid flattens custom args onto the event object, so it arrives as a
 * top-level field. `sg_message_id` is the fallback for events whose custom args
 * were stripped.
 */

import { prisma } from '@/lib/db/prisma';
import { normalizeSendGridMessageId } from '@/lib/integrations/sendgrid-utils';

export type TransactionalEmailEvent = {
  event?: string;
  sg_message_id?: string;
  email?: string;
  reason?: string;
  timestamp?: number;
  /** Custom arg attached by the mailer. */
  receipt_id?: string;
};

/**
 * Events that mean the message did NOT reach the person. A bounced password
 * reset is a support case, not a delivered email, and the receipt must say so.
 */
const FAILURE_EVENTS = new Set(['bounce', 'dropped', 'blocked', 'spamreport']);
const DELIVERED_EVENTS = new Set(['delivered']);
const ENGAGEMENT_EVENTS = new Set(['open', 'click']);
const DEFERRED_EVENTS = new Set(['deferred']);

/** Returns true when the event was matched to a receipt and applied. */
export async function applyTransactionalEmailEvent(
  event: TransactionalEmailEvent
): Promise<boolean> {
  const eventType = event.event?.toLowerCase();
  if (!eventType) return false;

  const known =
    FAILURE_EVENTS.has(eventType) ||
    DELIVERED_EVENTS.has(eventType) ||
    ENGAGEMENT_EVENTS.has(eventType) ||
    DEFERRED_EVENTS.has(eventType);
  if (!known) return false;

  let receipt = event.receipt_id
    ? await prisma.transactionalEmail.findUnique({
        where: { id: event.receipt_id },
        select: { id: true },
      })
    : null;

  if (!receipt) {
    const sgId = normalizeSendGridMessageId(event.sg_message_id);
    if (sgId) {
      receipt = await prisma.transactionalEmail.findFirst({
        where: { providerMessageId: { contains: sgId } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
    }
  }

  if (!receipt) return false;

  await prisma.transactionalEmail.update({
    where: { id: receipt.id },
    data: {
      deliveryStatus: eventType,
      deliveryDetail: FAILURE_EVENTS.has(eventType) || DEFERRED_EVENTS.has(eventType)
        ? (event.reason?.slice(0, 500) ?? eventType)
        : null,
      lastEventAt: event.timestamp ? new Date(event.timestamp * 1000) : new Date(),
    },
  });

  return true;
}
