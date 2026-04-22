/**
 * Next.js middleware session gate: verify access JWT from cookie (Edge).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from '@/lib/auth/session-cookies';
import { verifyAuthAccessJwt } from '@/lib/auth/jwt-tokens';

interface SessionUser {
  id: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
}

async function userFromAccessToken(token: string): Promise<SessionUser | null> {
  const claims = await verifyAuthAccessJwt(token);
  if (!claims) {
    return null;
  }
  return {
    id: claims.sub,
    email: claims.email ?? '',
    is_active: true,
    is_admin: claims.is_admin,
  };
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const token = request.cookies.get(AUTH_ACCESS_COOKIE)?.value;

  let user: SessionUser | null = null;
  if (token) {
    user = await userFromAccessToken(token);

    if (!user) {
      response.cookies.delete(AUTH_ACCESS_COOKIE);
      response.cookies.delete(AUTH_REFRESH_COOKIE);
    }
  }

  const publicPaths = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/guest',
    '/faq',
    '/product',
    '/how-it-works',
    '/pricing',
    '/features',
    '/contact',
    '/privacy',
    '/terms',
    '/api/cron',
    '/api/auth',
    '/api/public',
  ];
  const isPublicPath = publicPaths.some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/')
  );

  if (!isPublicPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const authPaths = ['/login', '/register'];
  const isAuthPath = authPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    const redirect = request.nextUrl.searchParams.get('redirect');
    url.pathname = redirect || '/dashboard';
    url.searchParams.delete('redirect');
    return NextResponse.redirect(url);
  }

  return response;
}
