import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonDetail, jsonOk, jsonValidationError, readJsonBody } from '@/lib/auth/http';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import { findAppUserByEmail, findAppUserById, insertAppUser } from '@/lib/auth/app-user-repo';
import { hashPassword } from '@/lib/auth/password';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';

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

  return jsonOk({
    member: mapAppUserRowToPublic(row),
    credentials: {
      email: row.email,
      temporary_password,
      role: row.role,
      must_change_password: true,
    },
  }, { status: 201 });
}
