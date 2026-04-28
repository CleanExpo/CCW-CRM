import type { NextRequest } from 'next/server';
import { AUTH_ACCESS_COOKIE } from '@/lib/auth/session-cookies';
import { verifyAccessJwt } from '@/lib/auth/jwt-tokens';

export function getAccessTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return request.cookies.get(AUTH_ACCESS_COOKIE)?.value ?? null;
}

/** Resolve user id from access JWT (Bearer or cookie). */
export async function getAuthClaimsFromRequest(
  request: NextRequest
): Promise<{
  sub: string;
  email: string;
  is_admin: boolean;
  role: 'owner' | 'admin' | 'member' | 'billing';
} | null> {
  const token = getAccessTokenFromRequest(request);
  if (!token) return null;
  return verifyAccessJwt(token);
}
