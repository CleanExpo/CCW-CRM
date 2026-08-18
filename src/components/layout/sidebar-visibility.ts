export type SidebarRole = 'owner' | 'admin' | 'member' | 'billing' | null;

/** Groups shown before /api/auth/me returns. Workspace must not wait on that fetch. */
export function shouldShowSidebarGroup(
  groupId: string,
  role: SidebarRole,
  roleResolved: boolean
): boolean {
  if (!roleResolved) return true;
  if (!role || role === 'owner' || role === 'admin') return true;
  if (role === 'billing') return groupId === 'finance' || groupId === 'admin';
  if (role === 'member') return groupId !== 'admin' && groupId !== 'finance';
  return true;
}
