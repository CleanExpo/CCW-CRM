import { findAppUserById, updateLastLogin } from '@/lib/auth/app-user-repo';
import { jsonDetail, jsonOk, readJsonBody } from '@/lib/auth/http';
import { signTokenPair, verifyMfaChallengeToken } from '@/lib/auth/jwt-tokens';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';
import { verifyUserMfa } from '@/lib/auth/mfa-totp';
import { setAuthSessionCookies } from '@/lib/auth/session-cookies';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  mfa_token: z.string().min(10),
  code: z.string().min(4).max(32),
});

export async function POST(request: NextRequest) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = bodySchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return jsonDetail('mfa_token and code are required', 422);
  }

  const challenge = await verifyMfaChallengeToken(parsed.data.mfa_token);
  if (!challenge || challenge.purpose !== 'verify') {
    return jsonDetail('MFA challenge expired or invalid — sign in again', 401);
  }

  const method = await verifyUserMfa(challenge.sub, parsed.data.code);
  if (!method) {
    return jsonDetail('Invalid authenticator or recovery code', 401);
  }

  const row = await findAppUserById(challenge.sub);
  if (!row || !row.isActive) {
    return jsonDetail('Account is disabled', 403);
  }

  await updateLastLogin(row.id);
  const tokens = await signTokenPair(row.id, row.email, row.isAdmin, row.role);
  const response = jsonOk({
    access_token: tokens.access_token,
    token_type: 'bearer',
    user: mapAppUserRowToPublic(row),
    mfa_method: method,
  });
  setAuthSessionCookies(response, tokens);
  return response;
}
