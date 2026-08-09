import { findAppUserById, updateLastLogin } from '@/lib/auth/app-user-repo';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { jsonDetail, jsonOk, readJsonBody } from '@/lib/auth/http';
import { signTokenPair, verifyMfaChallengeToken } from '@/lib/auth/jwt-tokens';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';
import { confirmMfaEnrollment } from '@/lib/auth/mfa-totp';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  code: z.string().min(6).max(12),
  mfa_token: z.string().min(10).optional(),
});

/** Confirm first TOTP code and enable MFA. Issues session when using enroll challenge. */
export async function POST(request: NextRequest) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = bodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonDetail('code is required', 422);

  let userId: string | null = null;
  let fromChallenge = false;

  if (parsed.data.mfa_token) {
    const challenge = await verifyMfaChallengeToken(parsed.data.mfa_token);
    if (!challenge || challenge.purpose !== 'enroll') {
      return jsonDetail('MFA enrollment challenge expired or invalid — sign in again', 401);
    }
    userId = challenge.sub;
    fromChallenge = true;
  } else {
    const scope = await requireAuthScope(request);
    if (!scope) return jsonDetail('Not authenticated', 401);
    userId = scope.userId;
  }

  const ok = await confirmMfaEnrollment(userId, parsed.data.code);
  if (!ok) {
    return jsonDetail(
      'Invalid authenticator code — check the time on your device and try again',
      400
    );
  }

  if (!fromChallenge) {
    return jsonOk({ enabled: true, detail: 'Multi-factor authentication is now enabled.' });
  }

  const row = await findAppUserById(userId);
  if (!row || !row.isActive) return jsonDetail('Account is disabled', 403);

  await updateLastLogin(row.id);
  const tokens = await signTokenPair(row.id, row.email, row.isAdmin, row.role);
  const response = jsonOk({
    enabled: true,
    access_token: tokens.access_token,
    token_type: 'bearer',
    user: mapAppUserRowToPublic(row),
    detail: 'MFA enabled — you are now signed in.',
  });
  setAuthSessionCookies(response, tokens);
  return response;
}
