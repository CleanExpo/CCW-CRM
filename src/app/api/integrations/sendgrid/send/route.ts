import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  getSendGridApiKey,
  getSendGridFromName,
  getSendGridSendReadiness,
  isValidEmailAddress,
  resolveSendGridFromEmail,
  sendMailViaSendGrid,
} from '@/lib/integrations/sendgrid-mail';
import { recordOutboundEmail } from '@/lib/integrations/sendgrid-persistence';

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
    conversation_id?: string;
  };

  const to_email = String(body.to_email ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const body_text = String(body.body_text ?? '').trim();
  const body_html = body.body_html != null ? String(body.body_html) : undefined;
  const conversationIdInput = body.conversation_id?.trim();

  if (!to_email || !subject || !body_text) {
    return NextResponse.json(
      { detail: 'to_email, subject, and body_text are required.' },
      { status: 400 }
    );
  }

  if (!isValidEmailAddress(to_email)) {
    return NextResponse.json({ detail: 'to_email is not a valid email address.' }, { status: 400 });
  }

  const readiness = await getSendGridSendReadiness(request);
  if (!readiness.ok) {
    return NextResponse.json({ detail: readiness.detail }, { status: readiness.status });
  }

  const apiKey = getSendGridApiKey(request);
  const fromEmail = resolveSendGridFromEmail(request);
  if (!apiKey || !fromEmail) {
    return NextResponse.json({ detail: readiness.payload.message }, { status: 503 });
  }

  const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

  if (conversationIdInput) {
    const thread = await prisma.emailThread.findFirst({
      where: { id: conversationIdInput, ownerUserId: { in: workspaceUserIds } },
    });
    if (!thread) {
      return NextResponse.json({ detail: 'Conversation not found' }, { status: 404 });
    }
    if (thread.customerEmail.toLowerCase() !== to_email.toLowerCase()) {
      return NextResponse.json(
        { detail: 'to_email does not match this conversation customer.' },
        { status: 400 }
      );
    }
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

  const conversationId = await recordOutboundEmail({
    ownerUserId: scope.userId,
    workspaceUserIds,
    toEmail: to_email,
    fromEmail,
    subject,
    bodyText: body_text,
    bodyHtml: body_html,
    sendgridMessageId: result.message_id || null,
    threadId: conversationIdInput || undefined,
  });

  return NextResponse.json({
    success: true,
    message_id: result.message_id,
    mode: result.mode,
    conversation_id: conversationId,
  });
}
