import { findAppUserById } from '@/lib/auth/app-user-repo';
import { verifyAccessJwt } from '@/lib/auth/jwt-tokens';
import { AUTH_ACCESS_COOKIE } from '@/lib/auth/session-cookies';
import type { NextRequest } from 'next/server';

export function getAccessTokenFromRequest(request: NextRequest): string | null {
  // Same order as middleware: the page session is the cookie. The browser
  // client also sends Authorization from localStorage, which can be an older
  // member token after a later owner/admin login — that was 403ing Phase 2
  // after a product/stock sync that does not check role.
  const cookie = request.cookies.get(AUTH_ACCESS_COOKIE)?.value?.trim();
  if (cookie) return cookie;
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return null;
}

/** Resolve user id from access JWT (Bearer or cookie). Rejects stale session versions. */
export async function getAuthClaimsFromRequest(request: NextRequest): Promise<{
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
  const role = user.role;
  if (role !== 'owner' && role !== 'admin' && role !== 'member' && role !== 'billing') {
    return null;
  }
  return {
    sub: claims.sub,
    email: claims.email ?? user.email,
    is_admin: user.isAdmin,
    role,
    session_version: claims.session_version,
  };
}
