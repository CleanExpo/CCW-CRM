import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function workspaceOwnerIds(userId: string): Promise<string[]> {
  return getWorkspaceMemberUserIds(userId);
}

export function bankAccountOwnerFilter(ownerIds: string[]) {
  return { ownerUserId: { in: ownerIds } };
}

export function ownerDataFilter(ownerIds: string[]) {
  return { ownerUserId: { in: ownerIds } };
}
