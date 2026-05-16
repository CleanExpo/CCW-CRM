import { prisma } from '@/lib/db/prisma';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { resolveSendGridCredentials } from '@/lib/integrations/sendgrid-config';
import { sendMailViaSendGrid } from '@/lib/integrations/sendgrid-mail';
import { recordOutboundEmail } from '@/lib/integrations/sendgrid-persistence';

const CONFIDENCE_DEFAULT = 0.8;

export function isSendGridAutoReplyEnabled(): boolean {
  return process.env.AI_EMAIL_AUTO_RESPONSE === 'true';
}

export function getSendGridAutoReplyConfidenceThreshold(): number {
  const n = Number(process.env.AI_EMAIL_CONFIDENCE_THRESHOLD ?? CONFIDENCE_DEFAULT);
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : CONFIDENCE_DEFAULT;
}

function buildAutoReplyBody(customerName: string | null, subject: string): string {
  const greeting = customerName ? `Hi ${customerName},` : 'Hello,';
  return [
    greeting,
    '',
    'Thank you for your email. We have received your message and a member of our team will respond shortly.',
    '',
    `Regarding: ${subject}`,
    '',
    'Best regards,',
    process.env.SENDGRID_FROM_NAME?.trim() || 'CCW Support',
  ].join('\n');
}

/**
 * Sends a courteous auto-reply when AI_EMAIL_AUTO_RESPONSE=true (no external AI dependency).
 */
export async function maybeSendInboundAutoReply(input: {
  threadId: string;
  ownerUserId: string;
  customerEmail: string;
  customerName: string | null;
  subject: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!isSendGridAutoReplyEnabled()) {
    return { sent: false, reason: 'auto_reply_disabled' };
  }

  const thread = await prisma.emailThread.findUnique({
    where: { id: input.threadId },
    select: { status: true },
  });
  if (!thread || thread.status === 'closed') {
    return { sent: false, reason: 'thread_closed' };
  }

  const creds = await resolveSendGridCredentials(undefined, input.ownerUserId);
  if (!creds.apiKey || !creds.fromEmail) {
    return { sent: false, reason: 'sendgrid_not_configured' };
  }

  const replySubject = input.subject.startsWith('Re:') ? input.subject : `Re: ${input.subject}`;
  const bodyText = buildAutoReplyBody(input.customerName, input.subject);

  const result = await sendMailViaSendGrid(creds.apiKey, creds.fromEmail, creds.fromName, {
    to_email: input.customerEmail,
    subject: replySubject,
    body_text: bodyText,
  });

  if (!result.ok) {
    return { sent: false, reason: result.detail };
  }

  const workspaceUserIds = await getWorkspaceMemberUserIds(input.ownerUserId);
  await recordOutboundEmail({
    ownerUserId: input.ownerUserId,
    workspaceUserIds,
    toEmail: input.customerEmail,
    fromEmail: creds.fromEmail,
    subject: replySubject,
    bodyText,
    sendgridMessageId: result.message_id,
    wasAiGenerated: true,
    threadId: input.threadId,
  });

  return { sent: true };
}
