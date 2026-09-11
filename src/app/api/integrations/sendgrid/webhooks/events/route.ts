import { NextRequest, NextResponse } from 'next/server';
import { verifySendGridEventWebhook } from '@/lib/integrations/sendgrid-webhook-auth';
import { applySendGridEvent, type SendGridEvent } from '@/lib/integrations/sendgrid-events';
import { applyTransactionalEmailEvent } from '@/lib/email/events';

/**
 * SendGrid Event Webhook — delivery, bounce, open, etc.
 * Production: enable Signed Event Webhook and set SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY.
 * Fallback: ?token=SENDGRID_WEBHOOK_SECRET
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySendGridEventWebhook(request, rawBody)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  // SendGrid flattens custom args onto the event, so `receipt_id` — set by the
  // transactional mailer — arrives as a top-level field. The parsed type has to
  // admit it or the resolver below is handed `undefined` for every event.
  type IncomingEvent = SendGridEvent & { receipt_id?: string };
  let events: IncomingEvent[];
  try {
    const parsed = JSON.parse(rawBody) as IncomingEvent | IncomingEvent[];
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  let applied = 0;
  let receiptsUpdated = 0;
  let unmatched = 0;
  for (const ev of events) {
    // A transactional receipt and a CRM thread message are different records;
    // an event belongs to at most one of them, so both resolvers are tried.
    const threadHit = await applySendGridEvent(ev);
    if (threadHit) applied += 1;
    const receiptHit = await applyTransactionalEmailEvent(ev);
    if (receiptHit) receiptsUpdated += 1;
    // An event matching nothing is reported rather than swallowed: a rising
    // count here means bounces are being recorded against no record at all.
    if (!threadHit && !receiptHit) unmatched += 1;
  }

  return NextResponse.json({
    success: true,
    processed: events.length,
    messages_updated: applied,
    receipts_updated: receiptsUpdated,
    unmatched,
  });
}
