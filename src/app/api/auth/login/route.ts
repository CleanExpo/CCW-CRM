import { NextRequest } from 'next/server';
import { loginBodySchema } from '@/lib/auth/schemas';
import { readJsonBody, jsonDetail, jsonValidationError, jsonOk } from '@/lib/auth/http';
import {
  findAppUserByEmail,
  updateLastLogin,
} from '@/lib/auth/app-user-repo';
import { verifyPassword } from '@/lib/auth/password';
import { signTokenPair } from '@/lib/auth/jwt-tokens';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';

export async function POST(request: NextRequest) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = loginBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const row = await findAppUserByEmail(parsed.data.email);
    if (!row) {
      return jsonDetail('Invalid email or password', 401);
    }
    if (!row.isActive) {
      return jsonDetail('Account is disabled', 403);
    }

    const ok = await verifyPassword(parsed.data.password, row.passwordHash);
    if (!ok) {
      return jsonDetail('Invalid email or password', 401);
    }

    await updateLastLogin(row.id);
    const tokens = await signTokenPair(row.id, row.email, row.isAdmin, row.role);
    const response = jsonOk({
      access_token: tokens.access_token,
      token_type: 'bearer',
      user: mapAppUserRowToPublic(row),
    });
    setAuthSessionCookies(response, tokens);
    return response;
  } catch (e) {
    console.error('[auth/login]', e);
    return jsonDetail('Authentication service unavailable', 503);
  }
}
