import { NextRequest, NextResponse } from 'next/server';
import { recordInboundEmail } from '@/lib/integrations/sendgrid-persistence';
import {
  getSendGridInboundOwnerUserId,
  verifySendGridWebhookSecret,
} from '@/lib/integrations/sendgrid-webhook-auth';
import { isValidEmailAddress } from '@/lib/integrations/sendgrid-mail';

/** SendGrid Inbound Parse — configure URL with ?token=SENDGRID_WEBHOOK_SECRET */
export async function POST(request: NextRequest) {
  if (!verifySendGridWebhookSecret(request)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const ownerUserId = getSendGridInboundOwnerUserId();
  if (!ownerUserId) {
    return NextResponse.json(
      {
        detail:
          'Set SENDGRID_INBOUND_OWNER_USER_ID or CRON_INTEGRATION_USER_ID so inbound mail can be assigned to a workspace user.',
      },
      { status: 503 }
    );
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

  const conversationId = await recordInboundEmail({
    ownerUserId,
    fromEmail,
    toEmail: toEmail || 'inbound@unknown',
    subject,
    bodyText,
    bodyHtml,
    customerName: parseDisplayName(fromRaw),
  });

  return NextResponse.json({ success: true, conversation_id: conversationId });
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
