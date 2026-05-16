import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getSendGridFromEmail, isSendGridDemoMode } from '@/lib/integrations/sendgrid-mail';

/**
 * Demo-only: creates a real persisted thread + inbound message so the Emails UI shows data.
 * Live inbound uses SendGrid Inbound Parse → POST /api/integrations/sendgrid/webhooks/inbound.
 */
export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  if (!isSendGridDemoMode()) {
    return NextResponse.json(
      {
        success: false,
        detail:
          'Inbound simulation is only available when SENDGRID_MODE=demo. Configure SENDGRID_API_KEY and SENDGRID_FROM_EMAIL for live Compose; conversations appear after you send mail.',
      },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const n = Math.max(1, Math.min(5, Number(url.searchParams.get('email_number') || '1')));
  const intents = ['order_inquiry', 'stock_check', 'quote_request', 'support', 'complaint'] as const;
  const intent = intents[(n - 1) % intents.length];

  const preview = {
    from: `demo.customer.${n}@example.com`,
    subject: `[Demo ${n}] Question about stock`,
    body: 'This is a simulated inbound message for UI testing.',
  };

  const toInbox = getSendGridFromEmail(request) || 'inbound@localhost';

  const thread = await prisma.emailThread.create({
    data: {
      ownerUserId: scope.userId,
      subject: preview.subject,
      customerEmail: preview.from,
      customerName: 'Demo Customer',
      status: 'open',
      intent,
      lastMessageAt: new Date(),
      messages: {
        create: {
          direction: 'inbound',
          fromEmail: preview.from,
          toEmail: toInbox,
          subject: preview.subject,
          bodyText: preview.body,
          wasAiGenerated: false,
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    mode: 'demo',
    email_variation: n,
    conversation_id: thread.id,
    intent,
    confidence: 0.92,
    response_sent: false,
    preview,
  });
}
