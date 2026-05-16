import { prisma } from '@/lib/db/prisma';

export type RecordOutboundEmailInput = {
  ownerUserId: string;
  workspaceUserIds: string[];
  toEmail: string;
  fromEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  sendgridMessageId?: string | null;
  wasAiGenerated?: boolean;
  /** When set, append to this thread (must belong to workspace). */
  threadId?: string;
};

export async function recordOutboundEmail(input: RecordOutboundEmailInput): Promise<string> {
  const {
    ownerUserId,
    workspaceUserIds,
    toEmail,
    fromEmail,
    subject,
    bodyText,
    bodyHtml,
    sendgridMessageId,
    wasAiGenerated = false,
    threadId,
  } = input;

  let existingThread = threadId
    ? await prisma.emailThread.findFirst({
        where: { id: threadId, ownerUserId: { in: workspaceUserIds } },
      })
    : await prisma.emailThread.findFirst({
        where: {
          ownerUserId: { in: workspaceUserIds },
          customerEmail: toEmail,
        },
        orderBy: { lastMessageAt: 'desc' },
      });

  const thread =
    existingThread ??
    (await prisma.emailThread.create({
      data: {
        ownerUserId,
        subject,
        customerEmail: toEmail,
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
        fromEmail,
        toEmail,
        subject,
        bodyText,
        bodyHtml: bodyHtml ?? null,
        sendgridMessageId: sendgridMessageId ?? null,
        wasAiGenerated,
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

  return thread.id;
}

export type RecordInboundEmailInput = {
  ownerUserId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  customerName?: string | null;
};

export async function recordInboundEmail(input: RecordInboundEmailInput): Promise<string> {
  const { ownerUserId, fromEmail, toEmail, subject, bodyText, bodyHtml, customerName } = input;

  const existingThread = await prisma.emailThread.findFirst({
    where: { ownerUserId, customerEmail: fromEmail },
    orderBy: { lastMessageAt: 'desc' },
  });

  const thread =
    existingThread ??
    (await prisma.emailThread.create({
      data: {
        ownerUserId,
        subject,
        customerEmail: fromEmail,
        customerName: customerName ?? null,
        status: 'open',
        lastMessageAt: new Date(),
      },
    }));

  await prisma.$transaction(async (tx) => {
    await tx.emailMessage.create({
      data: {
        threadId: thread.id,
        direction: 'inbound',
        fromEmail,
        toEmail,
        subject,
        bodyText,
        bodyHtml: bodyHtml ?? null,
        wasAiGenerated: false,
      },
    });
    await tx.emailThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        subject,
        status: 'open',
      },
    });
  });

  return thread.id;
}
