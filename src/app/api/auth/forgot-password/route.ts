import { createHash, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { forgotPasswordBodySchema } from '@/lib/auth/schemas';
import { readJsonBody, jsonDetail, jsonValidationError, jsonOk } from '@/lib/auth/http';
import { findAppUserByEmail, setPasswordResetFields } from '@/lib/auth/app-user-repo';
import { sendTransactionalEmail, type SendOutcome } from '@/lib/email/mailer';
import { buildPasswordResetEmail } from '@/lib/email/templates';
import { passwordResetUrl } from '@/lib/email/links';

const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Password reset request (UNI-2671).
 *
 * Until 2026-09-07 this route minted a token, stored its hash, and returned
 * "a password reset link has been sent" — while sending no email at all. The
 * sentence was false for every caller for two months, and because the response
 * was a 200 nothing anywhere reported a fault.
 *
 * Two things changed. The email is now actually sent, and the response no
 * longer asserts a delivery it cannot vouch for: `delivery` reports what really
 * happened to the send attempt, while the human-facing `message` stays
 * deliberately generic so the endpoint still does not disclose whether an
 * account exists.
 */
export async function POST(request: NextRequest) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = forgotPasswordBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const generic = {
    message:
      'If an account exists with that email, a password reset link is on its way. Check your inbox, including junk mail.',
  };

  try {
    const row = await findAppUserByEmail(parsed.data.email);
    if (!row || !row.isActive) {
      // No account: nothing to send, and the response must not reveal that.
      return jsonOk({ ...generic, delivery: { status: 'not_applicable' } });
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await setPasswordResetFields(row.id, tokenHash, expiresAt);

    const outcome = await sendResetEmail(row.email, rawToken);

    if (outcome.status !== 'sent') {
      // The token is valid but nobody has been told about it. That is an
      // operational fault, logged as one — not folded into a success message.
      console.error(
        `[auth/forgot-password] reset email not delivered: status=${outcome.status} receipt=${
          outcome.receiptId ?? 'none'
        } reason=${'reason' in outcome ? outcome.reason : ''}`
      );
    }

    const expose =
      process.env.NODE_ENV !== 'production' &&
      process.env.AUTH_DEV_EXPOSE_RESET_TOKEN === 'true';

    return jsonOk({
      ...generic,
      // Truthful send state. `sent` is the only value that means the provider
      // accepted the message; every other value means the user has not got it.
      delivery: { status: outcome.status, receipt_id: outcome.receiptId },
      ...(expose ? { dev_reset_token: rawToken } : {}),
    });
  } catch (e) {
    console.error('[auth/forgot-password]', e);
    return jsonDetail('Password reset service unavailable', 503);
  }
}

/**
 * Send the reset email without letting a mail problem fail the request.
 *
 * The token is already persisted by the time this runs, so the reset itself is
 * valid. A missing `NEXT_PUBLIC_APP_URL` or an unreachable provider must
 * therefore produce a truthful `failed` outcome — not a 503 that tells the user
 * the password-reset service is down when it is only the email that is.
 */
async function sendResetEmail(to: string, rawToken: string): Promise<SendOutcome> {
  try {
    return await sendTransactionalEmail({
      to,
      email: buildPasswordResetEmail({
        resetUrl: passwordResetUrl(rawToken),
        expiresInMinutes: Math.round(RESET_TTL_MS / 60_000),
      }),
    });
  } catch (error) {
    console.error('[auth/forgot-password] reset email could not be built or sent', error);
    return {
      status: 'failed',
      receiptId: '',
      reason: error instanceof Error ? error.message : 'reset email failed',
    };
  }
}
