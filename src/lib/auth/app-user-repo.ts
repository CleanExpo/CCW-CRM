import { randomUUID } from 'crypto';
import type { AppUser } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type AppUserRow = AppUser;

export async function countAppUsers(): Promise<number> {
  return prisma.appUser.count();
}

export async function findAppUserByEmail(normalizedEmail: string): Promise<AppUserRow | null> {
  return prisma.appUser.findFirst({
    where: { email: normalizedEmail.toLowerCase() },
  });
}

export async function findAppUserById(id: string): Promise<AppUserRow | null> {
  return prisma.appUser.findUnique({ where: { id } });
}

export async function findAppUserByResetHash(tokenHash: string): Promise<AppUserRow | null> {
  return prisma.appUser.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { gt: new Date() },
    },
  });
}

export async function insertAppUser(input: {
  email: string;
  password_hash: string;
  full_name: string | null;
  is_admin: boolean;
  role?: 'owner' | 'admin' | 'member' | 'billing';
  /** Existing workspace (inviter’s org). Omit to create a new solo workspace (id = new user id). */
  workspace_id?: string;
}): Promise<AppUserRow> {
  if (input.workspace_id) {
    return prisma.appUser.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.password_hash,
        fullName: input.full_name,
        isAdmin: input.is_admin,
        role: input.role ?? 'member',
        workspaceId: input.workspace_id,
      },
    });
  }
  const id = randomUUID();
  return prisma.appUser.create({
    data: {
      id,
      email: input.email.toLowerCase(),
      passwordHash: input.password_hash,
      fullName: input.full_name,
      isAdmin: input.is_admin,
      role: input.role ?? 'member',
      workspaceId: id,
    },
  });
}

export async function updateLastLogin(id: string): Promise<void> {
  await prisma.appUser.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}

export async function updateAppUserProfile(
  id: string,
  fields: { full_name?: string; email?: string }
): Promise<AppUserRow | null> {
  try {
    return await prisma.appUser.update({
      where: { id },
      data: {
        ...(fields.email !== undefined ? { email: fields.email.toLowerCase() } : {}),
        ...(fields.full_name !== undefined ? { fullName: fields.full_name } : {}),
      },
    });
  } catch {
    return null;
  }
}

export async function updatePasswordHash(id: string, password_hash: string): Promise<void> {
  await prisma.appUser.update({
    where: { id },
    data: {
      passwordHash: password_hash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });
}

export async function setPasswordResetFields(
  id: string,
  tokenHash: string,
  expiresAt: Date
): Promise<void> {
  await prisma.appUser.update({
    where: { id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
    },
  });
}

export async function emailExistsForOtherUser(
  normalizedEmail: string,
  excludeUserId: string
): Promise<boolean> {
  const n = await prisma.appUser.count({
    where: {
      email: normalizedEmail.toLowerCase(),
      NOT: { id: excludeUserId },
    },
  });
  return n > 0;
}
