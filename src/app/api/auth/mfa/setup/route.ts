import { findAppUserById } from '@/lib/auth/app-user-repo';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { jsonDetail, jsonOk, readJsonBody } from '@/lib/auth/http';
import { verifyMfaChallengeToken } from '@/lib/auth/jwt-tokens';
import { beginMfaEnrollment } from '@/lib/auth/mfa-totp';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const challengeBodySchema = z.object({
  mfa_token: z.string().min(10).optional(),
});

/**
 * Start MFA enrollment.
 * Auth: either a logged-in session OR a short-lived enroll challenge from login.
 */
export async function POST(request: NextRequest) {
  try {
    const parsedBody = await readJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const body = challengeBodySchema.safeParse(parsedBody.body ?? {});
    const mfaToken = body.success ? body.data.mfa_token : undefined;

    let userId: string | null = null;
    let email: string | null = null;

    if (mfaToken) {
      const challenge = await verifyMfaChallengeToken(mfaToken);
      if (!challenge || challenge.purpose !== 'enroll') {
        return jsonDetail('MFA enrollment challenge expired or invalid — sign in again', 401);
      }
      userId = challenge.sub;
      email = challenge.email;
    } else {
      const scope = await requireAuthScope(request);
      if (!scope) return jsonDetail('Not authenticated', 401);
      const row = await findAppUserById(scope.userId);
      if (!row) return jsonDetail('Not authenticated', 401);
      userId = row.id;
      email = row.email;
    }

    const enrollment = await beginMfaEnrollment(userId, email);
    return jsonOk({
      otpauth_uri: enrollment.otpauth_uri,
      secret: enrollment.secret,
      recovery_codes: enrollment.recovery_codes,
      detail:
        'Scan the otpauth URI in your authenticator app, then confirm with a 6-digit code. Store recovery codes securely — they are shown once.',
    });
  } catch (e) {
    console.error('[auth/mfa/setup]', e);
    return jsonDetail(e instanceof Error ? e.message : 'Could not start MFA setup', 503);
  }
}
