import { prisma } from '@/lib/db/prisma';
import { normalizeSendGridMessageId } from '@/lib/integrations/sendgrid-utils';

export type SendGridEvent = {
  event?: string;
  sg_message_id?: string;
  email?: string;
  reason?: string;
  timestamp?: number;
  thread_id?: string;
  message_id?: string;
};

const FAILURE_EVENTS = new Set(['bounce', 'dropped', 'blocked']);
const DELIVERED_EVENTS = new Set(['delivered', 'processed']);
const ENGAGEMENT_EVENTS = new Set(['open', 'click']);

export { normalizeSendGridMessageId } from '@/lib/integrations/sendgrid-utils';

export async function applySendGridEvent(ev: SendGridEvent): Promise<boolean> {
  const eventType = ev.event?.toLowerCase();
  if (!eventType) return false;

  // Resolution is intentionally exact-match only. This webhook is authenticated by a
  // shared secret or ECDSA signature (not a per-user/workspace session), and every
  // field on `ev` is attacker-influenceable JSON from the request body. A fuzzy
  // (`contains`) match on sendgridMessageId, or trusting a bare `thread_id` with no
  // corroborating message id, would let a forged or coincidentally-overlapping event
  // resolve to — and mutate — another tenant's email record. See UNI-2106.
  let msg =
    ev.message_id
      ? await prisma.emailMessage.findUnique({ where: { id: ev.message_id } })
      : null;

  const sgId = normalizeSendGridMessageId(ev.sg_message_id);
  if (!msg && sgId) {
    // Match on the normalized (base, pre-".filterNNN.xxx") id in both directions:
    // the stored value is whatever `sendMailViaSendGrid` recorded (which may or may
    // not carry the SMTP suffix), so compare exact-equality against either form
    // rather than falling back to a fuzzy `contains` that can match unrelated rows.
    msg = await prisma.emailMessage.findFirst({
      where: { OR: [{ sendgridMessageId: sgId }, { sendgridMessageId: ev.sg_message_id?.trim() }] },
    });
  }

  if (!msg) return false;

  const eventAt = ev.timestamp ? new Date(ev.timestamp * 1000) : new Date();
  let deliveryStatus = msg.deliveryStatus ?? 'pending';
  let deliveryDetail = msg.deliveryDetail;

  if (FAILURE_EVENTS.has(eventType)) {
    deliveryStatus = eventType;
    deliveryDetail = ev.reason?.slice(0, 500) ?? eventType;
    await prisma.emailThread.updateMany({
      where: { id: msg.threadId, status: { not: 'closed' } },
      data: { status: 'escalated' },
    });
  } else if (DELIVERED_EVENTS.has(eventType)) {
    deliveryStatus = 'delivered';
    deliveryDetail = null;
  } else if (ENGAGEMENT_EVENTS.has(eventType)) {
    deliveryStatus = eventType;
  } else if (eventType === 'deferred') {
    deliveryStatus = 'deferred';
    deliveryDetail = ev.reason?.slice(0, 500) ?? 'deferred';
  }

  await prisma.emailMessage.update({
    where: { id: msg.id },
    data: {
      deliveryStatus,
      deliveryDetail,
      lastEventAt: eventAt,
    },
  });

  return true;
}
