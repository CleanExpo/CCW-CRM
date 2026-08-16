import { findAppUserByEmail, insertAppUser } from '@/lib/auth/app-user-repo';
import { jsonDetail, jsonOk, jsonValidationError, readJsonBody } from '@/lib/auth/http';
import { signMfaChallengeToken, signTokenPair } from '@/lib/auth/jwt-tokens';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';
import { roleRequiresMfa } from '@/lib/auth/mfa-totp';
import { hashPassword } from '@/lib/auth/password';
import {
  isPublicRegistrationEnabled,
  PUBLIC_REGISTRATION_CLOSED_DETAIL,
} from '@/lib/auth/public-registration';
import { registerBodySchema } from '@/lib/auth/schemas';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';
import { NextRequest } from 'next/server';

function isPrismaUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002'
  );
}

export async function POST(request: NextRequest) {
  if (!isPublicRegistrationEnabled()) {
    return jsonDetail(PUBLIC_REGISTRATION_CLOSED_DETAIL, 403);
  }

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

    // Privilege telemetry, deliberately non-identifying: role and admin flag only, never the
    // email. It is emitted here so BOTH exits below are covered — the MFA-enrollment path added
    // in a7f4d1db returned early and dropped this call, which removed the only signal that says
    // what privilege a registration actually persisted.
    console.info('[auth/register] registration completed', {
      role: row.role,
      is_admin: row.isAdmin,
    });

    if (roleRequiresMfa(row.role, row.isAdmin)) {
      const mfa_token = await signMfaChallengeToken(row.id, row.email, 'enroll');
      return jsonOk({
        user: mapAppUserRowToPublic(row),
        message: 'Account created. Set up multi-factor authentication to continue.',
        mfa_enrollment_required: true,
        mfa_token,
      });
    }

    const tokens = await signTokenPair(row.id, row.email, row.isAdmin, row.role);
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
    console.error('[auth/register] registration failed', {
      errorType: e instanceof Error ? e.name : typeof e,
    });
    return jsonDetail('Registration service unavailable', 503);
  }
}
