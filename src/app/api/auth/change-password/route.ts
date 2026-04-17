import { NextRequest } from 'next/server';
import { changePasswordBodySchema } from '@/lib/auth/schemas';
import { readJsonBody, jsonDetail, jsonValidationError, jsonOk } from '@/lib/auth/http';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import { findAppUserById, updatePasswordHash } from '@/lib/auth/app-user-repo';
import { verifyPassword, hashPassword } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims) {
    return jsonDetail('Not authenticated', 401);
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = changePasswordBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const row = await findAppUserById(claims.sub);
    if (!row || !row.is_active) {
      return jsonDetail('Not authenticated', 401);
    }

    const ok = await verifyPassword(parsed.data.current_password, row.password_hash);
    if (!ok) {
      return jsonDetail('Current password is incorrect', 400);
    }

    const nextHash = await hashPassword(parsed.data.new_password);
    await updatePasswordHash(row.id, nextHash);

    return jsonOk({ message: 'Password changed successfully' });
  } catch (e) {
    console.error('[auth/change-password]', e);
    return jsonDetail('Password change unavailable', 503);
  }
}
