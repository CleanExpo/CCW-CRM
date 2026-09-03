import { NextRequest } from 'next/server';
import { z } from 'zod';
import { acceptInvitePassword, findAppUserByInviteHash } from '@/lib/auth/app-user-repo';
import { jsonDetail, jsonOk, jsonValidationError, readJsonBody } from '@/lib/auth/http';
import { hashInviteToken } from '@/lib/auth/invite-token';
import { hashPassword } from '@/lib/auth/password';

const schema = z.object({
  token: z.string().min(16),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = schema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const row = await findAppUserByInviteHash(hashInviteToken(parsed.data.token));
  if (!row?.isActive) return jsonDetail('Invite is invalid or expired', 400);

  await acceptInvitePassword(row.id, await hashPassword(parsed.data.password));
  return jsonOk({ email: row.email, must_change_password: false });
}
