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
  threadId?: string;
};

export type OutboundEmailRecord = {
  threadId: string;
  messageId: string;
};

async function resolveThread(
  input: Pick<RecordOutboundEmailInput, 'ownerUserId' | 'workspaceUserIds' | 'toEmail' | 'subject' | 'threadId'>
) {
  const { ownerUserId, workspaceUserIds, toEmail, subject, threadId } = input;

  const existingThread = threadId
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

  return (
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
    }))
  );
}

/** Creates thread + outbound message before SendGrid send (for custom_args tracking). */
export async function createOutboundEmailDraft(
  input: RecordOutboundEmailInput
): Promise<OutboundEmailRecord> {
  const thread = await resolveThread(input);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.emailMessage.create({
      data: {
        threadId: thread.id,
        direction: 'outbound',
        fromEmail: input.fromEmail,
        toEmail: input.toEmail,
        subject: input.subject,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml ?? null,
        deliveryStatus: 'pending',
        wasAiGenerated: input.wasAiGenerated ?? false,
      },
    });
    await tx.emailThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        subject: input.subject,
        status: 'responded',
      },
    });
    return created;
  });

  return { threadId: thread.id, messageId: message.id };
}

export async function finalizeOutboundEmail(
  messageId: string,
  sendgridMessageId: string | null
): Promise<void> {
  await prisma.emailMessage.update({
    where: { id: messageId },
    data: { sendgridMessageId },
  });
}

export async function markOutboundEmailFailed(messageId: string, detail: string): Promise<void> {
  await prisma.emailMessage.update({
    where: { id: messageId },
    data: {
      deliveryStatus: 'failed',
      deliveryDetail: detail.slice(0, 500),
      lastEventAt: new Date(),
    },
  });
}

export async function recordOutboundEmail(input: RecordOutboundEmailInput): Promise<string> {
  const draft = await createOutboundEmailDraft(input);
  if (input.sendgridMessageId) {
    await finalizeOutboundEmail(draft.messageId, input.sendgridMessageId);
  }
  return draft.threadId;
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

  const linkedCustomer = await prisma.customer.findFirst({
    where: {
      ownerUserId,
      email: { equals: fromEmail, mode: 'insensitive' },
    },
    select: { id: true },
  });

  const existingThread = await prisma.emailThread.findFirst({
    where: { ownerUserId, customerEmail: fromEmail },
    orderBy: { lastMessageAt: 'desc' },
  });

  const thread =
    existingThread ??
    (await prisma.emailThread.create({
      data: {
        ownerUserId,
        customerId: linkedCustomer?.id ?? null,
        subject,
        customerEmail: fromEmail,
        customerName: customerName ?? null,
        status: 'open',
        lastMessageAt: new Date(),
      },
    }));

  if (existingThread && linkedCustomer && !existingThread.customerId) {
    await prisma.emailThread.update({
      where: { id: existingThread.id },
      data: { customerId: linkedCustomer.id },
    });
  }

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
