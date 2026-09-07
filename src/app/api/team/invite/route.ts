import { createHash, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonDetail, jsonOk, jsonValidationError, readJsonBody } from '@/lib/auth/http';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import {
  findAppUserByEmail,
  findAppUserById,
  insertAppUser,
  setPasswordResetFields,
} from '@/lib/auth/app-user-repo';
import { hashPassword } from '@/lib/auth/password';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';
import { sendTransactionalEmail, type SendOutcome } from '@/lib/email/mailer';
import { buildTeamInvitationEmail } from '@/lib/email/templates';
import { invitationAcceptUrl } from '@/lib/email/links';

/** How long an invited person has to accept before the link stops working. */
const INVITE_TTL_HOURS = 48;

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().max(200).optional(),
  role: z.enum(['owner', 'admin', 'member', 'billing']).default('member'),
});

function generateTempPassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const nums = '23456789';
  const symbols = '!@#$%^&*';
  let out = 'Ccw#';
  for (let i = 0; i < 4; i += 1) out += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 3; i += 1) out += nums[Math.floor(Math.random() * nums.length)];
  out += symbols[Math.floor(Math.random() * symbols.length)];
  return out;
}

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

  const temporary_password = generateTempPassword();
  const row = await insertAppUser({
    email,
    full_name: parsed.data.full_name ?? null,
    password_hash: await hashPassword(temporary_password),
    is_admin: parsed.data.role === 'owner' || parsed.data.role === 'admin',
    role: parsed.data.role,
    workspace_id: inviter.workspaceId,
  });

  // Until 2026-09-07 the route stopped here: an account existed and the invited
  // person was never told. The admin was left to relay a temporary password by
  // some other channel, which for most invitations meant nothing happened at all.
  //
  // The invitation link is a password-reset token for the new account, so the
  // invitee sets their own password and no credential travels in the email.
  const invitation = await sendInvitationEmail({
    userId: row.id,
    email: row.email,
    inviteeName: parsed.data.full_name ?? null,
    inviterName: inviter.fullName ?? null,
    role: row.role,
  });

  return jsonOk({
    member: mapAppUserRowToPublic(row),
    // Truthful: `sent` is the only value meaning the invitee has been contacted.
    invitation_email: {
      status: invitation.status,
      receipt_id: invitation.receiptId,
      ...('reason' in invitation ? { reason: invitation.reason } : {}),
    },
    credentials: {
      email: row.email,
      temporary_password,
      role: row.role,
      must_change_password: true,
    },
  }, { status: 201 });
}

/**
 * Mint an invitation link and send it. Never throws: a failed invitation email
 * must not roll back an account that was created successfully, and the caller
 * is told the real outcome either way.
 */
async function sendInvitationEmail(input: {
  userId: string;
  email: string;
  inviteeName: string | null;
  inviterName: string | null;
  role: string;
}): Promise<SendOutcome> {
  try {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
    await setPasswordResetFields(input.userId, tokenHash, expiresAt);

    return await sendTransactionalEmail({
      to: input.email,
      email: buildTeamInvitationEmail({
        inviteeName: input.inviteeName,
        inviterName: input.inviterName,
        role: input.role,
        acceptUrl: invitationAcceptUrl(rawToken),
        expiresInHours: INVITE_TTL_HOURS,
      }),
    });
  } catch (error) {
    console.error('[team/invite] invitation email failed', error);
    return {
      status: 'failed',
      receiptId: '',
      reason: error instanceof Error ? error.message : 'invitation email failed',
    };
  }
}
