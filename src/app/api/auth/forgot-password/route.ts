import { createHash, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { forgotPasswordBodySchema } from '@/lib/auth/schemas';
import { readJsonBody, jsonDetail, jsonValidationError, jsonOk } from '@/lib/auth/http';
import { findAppUserByEmail, setPasswordResetFields } from '@/lib/auth/app-user-repo';

const RESET_TTL_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = forgotPasswordBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const generic = {
    message: 'If an account exists with that email, a password reset link has been sent.',
  };

  try {
    const row = await findAppUserByEmail(parsed.data.email);
    if (!row || !row.is_active) {
      return jsonOk(generic);
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await setPasswordResetFields(row.id, tokenHash, expiresAt);

    const expose =
      process.env.NODE_ENV !== 'production' &&
      process.env.AUTH_DEV_EXPOSE_RESET_TOKEN === 'true';

    return jsonOk(
      expose
        ? { ...generic, dev_reset_token: rawToken }
        : generic
    );
  } catch (e) {
    console.error('[auth/forgot-password]', e);
    return jsonDetail('Password reset service unavailable', 503);
  }
}
