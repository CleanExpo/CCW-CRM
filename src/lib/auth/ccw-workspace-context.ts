import { getWorkspaceIdForUser, getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export type CcwWorkspaceContext = {
  workspaceId: string;
  workspaceUserIds: string[];
  actingUserId: string;
};

/**
 * Resolves workspace membership for CCW add-on routes. Returns null when the user
 * has no workspace (callers should respond with 403).
 */
export async function resolveCcwWorkspaceContext(userId: string): Promise<CcwWorkspaceContext | null> {
  const workspaceId = await getWorkspaceIdForUser(userId);
  if (!workspaceId) return null;

  const workspaceUserIds = await getWorkspaceMemberUserIds(userId);
  return { workspaceId, workspaceUserIds, actingUserId: userId };
}

/**
 * Canonical `ownerUserId` for workspace-wide singleton rows (addon config, agent registry).
 * Matches POS / billing: `workspaceId` is the shared org key.
 */
export function ccwWorkspaceRecordOwnerId(ctx: CcwWorkspaceContext): string {
  return ctx.workspaceId;
}
