import { NextRequest } from 'next/server';
import { jsonDetail, jsonOk } from '@/lib/auth/http';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import { countOwners, deactivateUser } from '@/lib/auth/team-repo';
import { findAppUserById } from '@/lib/auth/app-user-repo';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims) return jsonDetail('Not authenticated', 401);
  if (claims.role !== 'owner' && claims.role !== 'admin') return jsonDetail('Forbidden', 403);

  const { userId } = await params;
  const target = await findAppUserById(userId);
  if (!target) return jsonDetail('User not found', 404);

  if (target.role === 'owner') {
    const ownerCount = await countOwners();
    if (ownerCount <= 1) {
      return jsonDetail('Cannot remove the last owner', 409);
    }
  }

  await deactivateUser(userId);
  return jsonOk({ success: true });
}
