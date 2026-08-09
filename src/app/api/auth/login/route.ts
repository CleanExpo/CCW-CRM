import { findAppUserByEmail, updateLastLogin } from '@/lib/auth/app-user-repo';
import { jsonDetail, jsonOk, jsonValidationError, readJsonBody } from '@/lib/auth/http';
import { signMfaChallengeToken, signTokenPair } from '@/lib/auth/jwt-tokens';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';
import { roleRequiresMfa } from '@/lib/auth/mfa-totp';
import { verifyPassword } from '@/lib/auth/password';
import { loginBodySchema } from '@/lib/auth/schemas';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';
import { NextRequest } from 'next/server';

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

    const mfaRequired = roleRequiresMfa(row.role, row.isAdmin);

    if (row.totpEnabled) {
      const mfa_token = await signMfaChallengeToken(row.id, row.email, 'verify');
      return jsonOk({
        mfa_required: true,
        mfa_token,
        user: { id: row.id, email: row.email },
      });
    }

    if (mfaRequired) {
      const mfa_token = await signMfaChallengeToken(row.id, row.email, 'enroll');
      return jsonOk({
        mfa_enrollment_required: true,
        mfa_token,
        user: { id: row.id, email: row.email },
        detail: 'Multi-factor authentication must be set up before access is granted.',
      });
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
