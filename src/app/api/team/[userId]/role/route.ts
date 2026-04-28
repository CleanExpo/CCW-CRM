import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonDetail, jsonOk, jsonValidationError, readJsonBody } from '@/lib/auth/http';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import { countOwners, updateUserRole } from '@/lib/auth/team-repo';
import { findAppUserById } from '@/lib/auth/app-user-repo';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';

const schema = z.object({ role: z.enum(['owner', 'admin', 'member', 'billing']) });

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims) return jsonDetail('Not authenticated', 401);
  if (claims.role !== 'owner' && claims.role !== 'admin') return jsonDetail('Forbidden', 403);

  const { userId } = await params;
  const target = await findAppUserById(userId);
  if (!target) return jsonDetail('User not found', 404);

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = schema.safeParse(parsedBody.body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  if (target.role === 'owner' && parsed.data.role !== 'owner') {
    const ownerCount = await countOwners();
    if (ownerCount <= 1) {
      return jsonDetail('Cannot demote the last owner', 409);
    }
  }

  const role = parsed.data.role;
  const updated = await updateUserRole(userId, role, role === 'owner' || role === 'admin');
  return jsonOk(mapAppUserRowToPublic(updated));
}
