import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  getSendGridApiKey,
  getSendGridFromEmail,
  getSendGridFromName,
  sendMailViaSendGrid,
} from '@/lib/integrations/sendgrid-mail';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    to_email?: string;
    subject?: string;
    body_text?: string;
    body_html?: string | null;
  };

  const to_email = String(body.to_email ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const body_text = String(body.body_text ?? '').trim();
  const body_html = body.body_html != null ? String(body.body_html) : undefined;

  if (!to_email || !subject || !body_text) {
    return NextResponse.json(
      { detail: 'to_email, subject, and body_text are required.' },
      { status: 400 }
    );
  }

  const apiKey = getSendGridApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { detail: 'SendGrid is not configured. Set SENDGRID_API_KEY or save a key in Settings → Integrations.' },
      { status: 503 }
    );
  }

  const fromEmail = getSendGridFromEmail(request);
  if (!fromEmail) {
    return NextResponse.json(
      {
        detail:
          'Missing verified sender address. Set SENDGRID_FROM_EMAIL or configure it in Settings → Integrations.',
      },
      { status: 400 }
    );
  }

  const fromName = getSendGridFromName(request);
  const result = await sendMailViaSendGrid(apiKey, fromEmail, fromName, {
    to_email,
    subject,
    body_text,
    body_html,
  });

  if (!result.ok) {
    const code =
      result.status >= 400 && result.status < 600 ? result.status : 502;
    return NextResponse.json(
      { success: false, detail: result.detail, mode: 'live' as const },
      { status: code }
    );
  }

  return NextResponse.json({
    success: true,
    message_id: result.message_id,
    mode: result.mode,
  });
}
