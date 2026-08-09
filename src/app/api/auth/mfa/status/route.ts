import { findAppUserById } from '@/lib/auth/app-user-repo';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { jsonDetail, jsonOk } from '@/lib/auth/http';
import { roleRequiresMfa } from '@/lib/auth/mfa-totp';
import { prisma } from '@/lib/db/prisma';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return jsonDetail('Not authenticated', 401);

  const row = await findAppUserById(scope.userId);
  if (!row) return jsonDetail('Not authenticated', 401);

  const unusedRecovery = await prisma.appUserMfaRecoveryCode.count({
    where: { userId: row.id, usedAt: null },
  });

  return jsonOk({
    enabled: row.totpEnabled,
    verified_at: row.totpVerifiedAt?.toISOString() ?? null,
    enforced: roleRequiresMfa(row.role, row.isAdmin),
    recovery_codes_remaining: unusedRecovery,
  });
}
