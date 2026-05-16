import { NextRequest, NextResponse } from 'next/server';
import { recordInboundEmail } from '@/lib/integrations/sendgrid-persistence';
import { maybeSendInboundAutoReply } from '@/lib/integrations/sendgrid-auto-reply';
import { resolveInboundOwnerUserId } from '@/lib/integrations/sendgrid-inbound-routing';
import { verifySendGridInboundWebhook } from '@/lib/integrations/sendgrid-webhook-auth';
import { isValidEmailAddress } from '@/lib/integrations/sendgrid-mail';

/** SendGrid Inbound Parse — configure URL with ?token=SENDGRID_WEBHOOK_SECRET */
export async function POST(request: NextRequest) {
  if (!verifySendGridInboundWebhook(request)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ detail: 'Expected multipart form body from Inbound Parse' }, { status: 400 });
  }

  const fromRaw = String(form.get('from') ?? form.get('sender') ?? '').trim();
  const toRaw = String(form.get('to') ?? '').trim();
  const subject = String(form.get('subject') ?? '(no subject)').trim();
  const bodyText = String(form.get('text') ?? form.get('html') ?? '').trim() || '(empty message)';
  const bodyHtml = form.get('html') != null ? String(form.get('html')) : null;

  const fromEmail = extractEmailAddress(fromRaw);
  const toEmail = extractEmailAddress(toRaw);

  if (!fromEmail || !isValidEmailAddress(fromEmail)) {
    return NextResponse.json({ detail: 'Could not parse sender email from inbound payload' }, { status: 400 });
  }

  const ownerUserId = await resolveInboundOwnerUserId(toEmail || toRaw);
  if (!ownerUserId) {
    return NextResponse.json(
      {
        detail:
          'Could not resolve inbound owner. Set SENDGRID_INBOUND_OWNER_USER_ID or configure workspace inbound mailbox.',
      },
      { status: 503 }
    );
  }

  const conversationId = await recordInboundEmail({
    ownerUserId,
    fromEmail,
    toEmail: toEmail || 'inbound@unknown',
    subject,
    bodyText,
    bodyHtml,
    customerName: parseDisplayName(fromRaw),
  });

  const autoReply = await maybeSendInboundAutoReply({
    threadId: conversationId,
    ownerUserId,
    customerEmail: fromEmail,
    customerName: parseDisplayName(fromRaw),
    subject,
  });

  return NextResponse.json({
    success: true,
    conversation_id: conversationId,
    auto_reply: autoReply,
  });
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  const simple = raw.trim().toLowerCase();
  if (simple.includes('@')) return simple.split(/\s+/).pop() ?? simple;
  return '';
}

function parseDisplayName(raw: string): string | null {
  const match = raw.match(/^([^<]+)</);
  const name = match?.[1]?.trim();
  return name || null;
}
