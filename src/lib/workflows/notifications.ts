import { prisma } from '@/lib/db/prisma';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function createInAppNotification(input: {
  userId: string;
  title: string;
  message: string;
  notificationType: string;
  entityType?: string;
  entityId?: string;
}) {
  return prisma.inAppNotification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      notificationType: input.notificationType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });
}

export async function notifyWorkspaceMembers(input: {
  actorUserId: string;
  title: string;
  message: string;
  notificationType: string;
  entityType?: string;
  entityId?: string;
}) {
  const memberIds = await getWorkspaceMemberUserIds(input.actorUserId);
  await prisma.inAppNotification.createMany({
    data: memberIds.map((userId) => ({
      userId,
      title: input.title,
      message: input.message,
      notificationType: input.notificationType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })),
  });
}
