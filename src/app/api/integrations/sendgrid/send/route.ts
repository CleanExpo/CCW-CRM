import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
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

  const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
  const existingThread = await prisma.emailThread.findFirst({
    where: {
      ownerUserId: { in: workspaceUserIds },
      customerEmail: to_email,
    },
    orderBy: { lastMessageAt: 'desc' },
  });

  const thread =
    existingThread ??
    (await prisma.emailThread.create({
      data: {
        ownerUserId: scope.userId,
        subject,
        customerEmail: to_email,
        customerName: null,
        status: 'responded',
        lastMessageAt: new Date(),
      },
    }));

  await prisma.$transaction(async (tx) => {
    await tx.emailMessage.create({
      data: {
        threadId: thread.id,
        direction: 'outbound',
        fromEmail: fromEmail,
        toEmail: to_email,
        subject,
        bodyText: body_text,
        bodyHtml: body_html ?? null,
        sendgridMessageId: result.message_id || null,
        wasAiGenerated: false,
      },
    });
    await tx.emailThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        subject,
        status: 'responded',
      },
    });
  });

  return NextResponse.json({
    success: true,
    message_id: result.message_id,
    mode: result.mode,
    conversation_id: thread.id,
  });
}
