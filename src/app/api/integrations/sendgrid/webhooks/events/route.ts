import { NextRequest, NextResponse } from 'next/server';
import { verifySendGridEventWebhook } from '@/lib/integrations/sendgrid-webhook-auth';
import { applySendGridEvent, type SendGridEvent } from '@/lib/integrations/sendgrid-events';

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

  let events: SendGridEvent[];
  try {
    const parsed = JSON.parse(rawBody) as SendGridEvent | SendGridEvent[];
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
  }

  let applied = 0;
  for (const ev of events) {
    if (await applySendGridEvent(ev)) applied += 1;
  }

  return NextResponse.json({
    success: true,
    processed: events.length,
    messages_updated: applied,
  });
}
