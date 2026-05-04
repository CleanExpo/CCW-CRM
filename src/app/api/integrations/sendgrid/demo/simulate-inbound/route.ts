import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { isSendGridDemoMode } from '@/lib/integrations/sendgrid-mail';

/**
 * Demo-only stub for the email UI. Live inbound requires SendGrid Inbound Parse + persistence.
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
          'Inbound simulation is only available when SENDGRID_MODE=demo. For live mail, use Compose or transactional APIs.',
      },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const n = Math.max(1, Math.min(5, Number(url.searchParams.get('email_number') || '1')));
  const intents = ['order_inquiry', 'stock_check', 'quote_request', 'support', 'complaint'] as const;
  const intent = intents[(n - 1) % intents.length];

  return NextResponse.json({
    success: true,
    mode: 'demo',
    email_variation: n,
    conversation_id: `demo-conv-${Date.now()}`,
    intent,
    confidence: 0.92,
    response_sent: false,
    preview: {
      from: 'customer@example.com',
      subject: `[Demo ${n}] Question about stock`,
      body: 'This is a simulated inbound message for UI testing.',
    },
  });
}
