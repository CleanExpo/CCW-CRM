import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { resetPasswordBodySchema } from '@/lib/auth/schemas';
import { readJsonBody, jsonDetail, jsonValidationError, jsonOk } from '@/lib/auth/http';
import { findAppUserByResetHash, updatePasswordHash } from '@/lib/auth/app-user-repo';
import { hashPassword } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;

  const parsed = resetPasswordBodySchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
    const row = await findAppUserByResetHash(tokenHash);
    if (!row) {
      return jsonDetail('Invalid or expired reset token', 401);
    }

    const nextHash = await hashPassword(parsed.data.new_password);
    await updatePasswordHash(row.id, nextHash);

    return jsonOk({ message: 'Password has been reset successfully' });
  } catch (e) {
    console.error('[auth/reset-password]', e);
    return jsonDetail('Password reset unavailable', 503);
  }
}
