import { findAppUserByEmail, insertAppUser } from '@/lib/auth/app-user-repo';
import { jsonDetail, jsonOk, jsonValidationError, readJsonBody } from '@/lib/auth/http';
import { signTokenPair } from '@/lib/auth/jwt-tokens';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';
import { hashPassword } from '@/lib/auth/password';
import { registerBodySchema } from '@/lib/auth/schemas';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';
import { NextRequest } from 'next/server';

function isPrismaUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002'
  );
}

export async function POST(request: NextRequest) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = registerBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const existing = await findAppUserByEmail(parsed.data.email);
    if (existing) {
      return jsonDetail('An account with this email already exists', 409);
    }

    const password_hash = await hashPassword(parsed.data.password);
    const row = await insertAppUser({
      email: parsed.data.email,
      password_hash,
      full_name: parsed.data.full_name ?? null,
      is_admin: false,
      role: 'member',
    });

    const tokens = await signTokenPair(row.id, row.email, row.isAdmin, row.role);
    console.info('[auth/register] registration completed', {
      role: row.role,
      is_admin: row.isAdmin,
    });
    const response = jsonOk({
      user: mapAppUserRowToPublic(row),
      message: 'User registered successfully',
      access_token: tokens.access_token,
      token_type: 'bearer',
    });
    setAuthSessionCookies(response, tokens);
    return response;
  } catch (e: unknown) {
    if (isPrismaUniqueViolation(e)) {
      return jsonDetail('An account with this email already exists', 409);
    }
    console.error('[auth/register] registration failed');
    return jsonDetail('Registration service unavailable', 503);
  }
}
