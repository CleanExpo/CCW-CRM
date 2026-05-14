import { prisma } from '@/lib/db/prisma';

/**
 * Returns all active app user ids in the same workspace as `userId`.
 * CRM entities (customers, products, …) are stored per `ownerUserId`; sharing within a team
 * uses this list so teammates see each other's catalog rows.
 *
 * On DB errors or missing workspace membership, falls back to `[userId]` so list APIs still respond.
 */
export async function getWorkspaceMemberUserIds(userId: string): Promise<string[]> {
  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { workspaceId: true },
    });
    if (!user) return [userId];

    const members = await prisma.appUser.findMany({
      where: { workspaceId: user.workspaceId, isActive: true },
      select: { id: true },
    });

    const ids = members.map((m) => m.id).filter(Boolean);
    return ids.length > 0 ? ids : [userId];
  } catch {
    return [userId];
  }
}

/** Workspace id for the given user, or null if the user row is missing. */
export async function getWorkspaceIdForUser(userId: string): Promise<string | null> {
  try {
    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { workspaceId: true },
    });
    return user?.workspaceId ?? null;
  } catch {
    return null;
  }
}
