import type { NextRequest } from 'next/server';
import { findAppUserById } from '@/lib/auth/app-user-repo';
import { AUTH_ACCESS_COOKIE } from '@/lib/auth/session-cookies';
import { verifyAccessJwt } from '@/lib/auth/jwt-tokens';

export function getAccessTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return request.cookies.get(AUTH_ACCESS_COOKIE)?.value ?? null;
}

/** Resolve user id from access JWT (Bearer or cookie). Rejects stale session versions. */
export async function getAuthClaimsFromRequest(
  request: NextRequest
): Promise<{
  sub: string;
  email: string;
  is_admin: boolean;
  role: 'owner' | 'admin' | 'member' | 'billing';
  session_version: number;
} | null> {
  const token = getAccessTokenFromRequest(request);
  if (!token) return null;
  const claims = await verifyAccessJwt(token);
  if (!claims) return null;
  const user = await findAppUserById(claims.sub);
  if (!user?.isActive) return null;
  if ((user.sessionVersion ?? 0) !== claims.session_version) return null;
  return claims;
}
