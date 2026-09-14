import { findAppUserByEmail, findAppUserById, insertAppUser } from '@/lib/auth/app-user-repo';
import { jsonDetail, jsonOk, jsonValidationError, readJsonBody } from '@/lib/auth/http';
import { createInviteToken, inviteAcceptUrl } from '@/lib/auth/invite-token';
import { sendTeamInviteViaMailtrap } from '@/lib/auth/mailtrap-invite';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';
import { hashPassword } from '@/lib/auth/password';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import { NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().max(200).optional(),
  role: z.enum(['owner', 'admin', 'member', 'billing']).default('member'),
});

export async function POST(request: NextRequest) {
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims) return jsonDetail('Not authenticated', 401);
  if (claims.role !== 'owner' && claims.role !== 'admin') return jsonDetail('Forbidden', 403);

  const inviter = await findAppUserById(claims.sub);
  if (!inviter?.isActive) return jsonDetail('Not authenticated', 401);
  const inviterIsPrivileged =
    (inviter.role === 'owner' || inviter.role === 'admin') && inviter.isAdmin;
  if (!inviterIsPrivileged) return jsonDetail('Forbidden', 403);

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = inviteSchema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  const email = parsed.data.email.toLowerCase();
  const existing = await findAppUserByEmail(email);
  if (existing) return jsonDetail('An account with this email already exists', 409);

  const invite = createInviteToken();
  const unusablePassword = randomBytes(32).toString('base64url');
  const row = await insertAppUser({
    email,
    full_name: parsed.data.full_name ?? null,
    password_hash: await hashPassword(unusablePassword),
    is_admin: parsed.data.role === 'owner' || parsed.data.role === 'admin',
    role: parsed.data.role,
    workspace_id: inviter.workspaceId,
    must_change_password: true,
    invite_token_hash: invite.hash,
    invite_token_expires_at: invite.expiresAt,
  });

  const mailed = await sendTeamInviteViaMailtrap({
    toEmail: row.email,
    acceptUrl: inviteAcceptUrl(invite.token),
  });
  if (!mailed.ok) {
    return jsonDetail(mailed.detail, 503);
  }

  return jsonOk(
    {
      member: mapAppUserRowToPublic(row),
      invite: {
        email: row.email,
        role: row.role,
        delivery: 'mailtrap',
        must_set_password: true,
      },
    },
    { status: 201 }
  );
}
