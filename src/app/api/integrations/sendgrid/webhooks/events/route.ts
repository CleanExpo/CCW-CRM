import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifySendGridWebhookSecret } from '@/lib/integrations/sendgrid-webhook-auth';

type SendGridEvent = {
  event?: string;
  sg_message_id?: string;
  email?: string;
  reason?: string;
  timestamp?: number;
};

/**
 * SendGrid Event Webhook — delivery, bounce, open, etc.
 * Configure POST URL with ?token=SENDGRID_WEBHOOK_SECRET (or Authorization: Bearer).
 */
export async function POST(request: NextRequest) {
  if (!verifySendGridWebhookSecret(request)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  let events: SendGridEvent[];
  try {
    const body = await request.json();
    events = Array.isArray(body) ? body : [body as SendGridEvent];
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  let updated = 0;
  for (const ev of events) {
    const eventType = ev.event?.toLowerCase();
    const rawId = ev.sg_message_id?.trim();
    if (!eventType || !rawId) continue;

    const messageId = rawId.split('.')[0];
    const msg = await prisma.emailMessage.findFirst({
      where: { sendgridMessageId: { contains: messageId } },
    });
    if (!msg) continue;

    if (eventType === 'bounce' || eventType === 'dropped' || eventType === 'blocked') {
      await prisma.emailThread.updateMany({
        where: { id: msg.threadId, status: { not: 'closed' } },
        data: { status: 'escalated' },
      });
      updated += 1;
    }
  }

  return NextResponse.json({ success: true, processed: events.length, threads_updated: updated });
}
