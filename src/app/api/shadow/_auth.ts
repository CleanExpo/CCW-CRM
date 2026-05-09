import type { NextRequest } from 'next/server';
import { jsonDetail } from '@/lib/auth/http';
import { getAuthClaimsFromRequest } from '@/lib/auth/request-token';

export async function requireShadowAuth(request: NextRequest) {
  const claims = await getAuthClaimsFromRequest(request);
  if (!claims) {
    return { ok: false as const, response: jsonDetail('Not authenticated', 401) };
  }
  return { ok: true as const, userId: claims.sub };
}
