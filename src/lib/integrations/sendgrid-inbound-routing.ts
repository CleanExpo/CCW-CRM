import { prisma } from '@/lib/db/prisma';
import { getSendGridInboundOwnerUserId } from '@/lib/integrations/sendgrid-webhook-auth';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resolves which workspace user should own an inbound message.
 * Priority: env fallback → workspace inbound mailbox → workspace from email → env from email.
 */
export async function resolveInboundOwnerUserId(toEmail: string): Promise<string | null> {
  const fallback = getSendGridInboundOwnerUserId();
  const to = normalizeEmail(toEmail);
  if (!to) return fallback;

  const wsByMailbox = await prisma.workspaceSendGridConfig.findFirst({
    where: { inboundMailboxEmail: { equals: to, mode: 'insensitive' } },
    select: { workspaceId: true },
  });
  if (wsByMailbox) {
    const owner = await prisma.appUser.findFirst({
      where: { workspaceId: wsByMailbox.workspaceId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (owner) return owner.id;
  }

  const wsByFrom = await prisma.workspaceSendGridConfig.findFirst({
    where: { fromEmail: { equals: to, mode: 'insensitive' } },
    select: { workspaceId: true },
  });
  if (wsByFrom) {
    const owner = await prisma.appUser.findFirst({
      where: { workspaceId: wsByFrom.workspaceId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (owner) return owner.id;
  }

  const envFrom = process.env.SENDGRID_FROM_EMAIL?.trim();
  if (envFrom && normalizeEmail(envFrom) === to) {
    return fallback;
  }

  return fallback;
}
