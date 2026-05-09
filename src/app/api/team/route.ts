import { NextRequest } from 'next/server';
import { jsonDetail, jsonOk } from '@/lib/auth/http';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';
import { findAppUserById } from '@/lib/auth/app-user-repo';
import { listTeamMembers } from '@/lib/auth/team-repo';
import { mapAppUserRowToPublic } from '@/lib/auth/map-user';

export async function GET(request: NextRequest) {
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims) return jsonDetail('Not authenticated', 401);
  if (claims.role !== 'owner' && claims.role !== 'admin') return jsonDetail('Forbidden', 403);

  const actor = await findAppUserById(claims.sub);
  if (!actor?.isActive) return jsonDetail('Not authenticated', 401);

  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') ?? '1'));
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('page_size') ?? '50')));
  const search = request.nextUrl.searchParams.get('search') || undefined;
  const roleParam = request.nextUrl.searchParams.get('role');
  const role = roleParam === 'owner' || roleParam === 'admin' || roleParam === 'member' || roleParam === 'billing'
    ? roleParam
    : undefined;

  const result = await listTeamMembers({
    workspaceId: actor.workspaceId,
    page,
    pageSize,
    search,
    role,
  });
  return jsonOk({
    data: result.data.map(mapAppUserRowToPublic),
    total: result.total,
    page,
    page_size: pageSize,
    total_pages: Math.max(1, Math.ceil(result.total / pageSize)),
  });
}
