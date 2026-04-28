import { prisma } from '@/lib/db/prisma';

export type TeamRole = 'owner' | 'admin' | 'member' | 'billing';

export async function listTeamMembers(params: {
  page: number;
  pageSize: number;
  search?: string;
  role?: TeamRole;
}) {
  const where = {
    ...(params.search
      ? {
          OR: [
            { email: { contains: params.search, mode: 'insensitive' as const } },
            { fullName: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(params.role ? { role: params.role } : {}),
  };

  const [total, data] = await Promise.all([
    prisma.appUser.count({ where }),
    prisma.appUser.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
  ]);

  return { total, data };
}

export async function countOwners(): Promise<number> {
  return prisma.appUser.count({ where: { role: 'owner', isActive: true } });
}

export async function updateUserRole(userId: string, role: TeamRole, isAdmin: boolean) {
  return prisma.appUser.update({
    where: { id: userId },
    data: { role, isAdmin },
  });
}

export async function deactivateUser(userId: string) {
  return prisma.appUser.update({
    where: { id: userId },
    data: { isActive: false },
  });
}
