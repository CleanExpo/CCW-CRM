import type { AppUser } from '@prisma/client';

export interface AppAuthUser {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  last_login_at?: string;
}

export function mapAppUserRowToPublic(row: AppUser): AppAuthUser {
  return {
    id: row.id,
    email: row.email,
    full_name: row.fullName ?? undefined,
    is_active: row.isActive,
    is_admin: row.isAdmin,
    created_at: row.createdAt.toISOString(),
    last_login_at: row.lastLoginAt?.toISOString(),
  };
}
