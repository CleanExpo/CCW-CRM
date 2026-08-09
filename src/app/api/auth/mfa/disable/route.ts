import { findAppUserById } from '@/lib/auth/app-user-repo';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { jsonDetail, jsonOk, readJsonBody } from '@/lib/auth/http';
import { disableMfa, roleRequiresMfa, verifyUserMfa } from '@/lib/auth/mfa-totp';
import { verifyPassword } from '@/lib/auth/password';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  password: z.string().min(1),
  code: z.string().min(4).max(32),
});

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) return jsonDetail('Not authenticated', 401);

  if (roleRequiresMfa(scope.role, scope.isAdmin)) {
    return jsonDetail(
      'MFA is required for internal Optix accounts and cannot be disabled while enforcement is on.',
      403
    );
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = bodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDetail('password and code are required', 422);

  const row = await findAppUserById(scope.userId);
  if (!row) return jsonDetail('Not authenticated', 401);

  const passwordOk = await verifyPassword(parsed.data.password, row.passwordHash);
  if (!passwordOk) return jsonDetail('Invalid password', 401);

  const method = await verifyUserMfa(row.id, parsed.data.code);
  if (!method) return jsonDetail('Invalid authenticator or recovery code', 401);

  await disableMfa(row.id);
  return jsonOk({ enabled: false, detail: 'Multi-factor authentication has been disabled.' });
}
