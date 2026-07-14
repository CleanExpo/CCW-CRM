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
  role: 'owner' | 'admin' | 'member' | 'billing';
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
    role: claims.role,
  };
}

export async function updateSession(request: NextRequest) {
  const billingAllowedPrefixes = [
    '/dashboard/settings/billing',
    '/settings/billing',
    '/dashboard/finance',
    '/dashboard',
  ];
  const memberBlockedPrefixes = [
    '/dashboard/settings/',
    '/settings/',
    '/approvals',
    '/alerts',
    '/monitoring',
    '/faq',
    '/dashboard/finance',
  ];

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
    // PWA / install metadata must load without a session (browser requests it independently).
    '/manifest.json',
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
    '/api/auth',
    // OAuth redirects must load without a prior session (provider sends user back to callback).
    '/api/integrations/xero/callback',
    '/api/integrations/xero/auth',
    '/api/integrations/shopify/callback',
    '/api/integrations/shopify/authorize',
  ];

  const pathMatchesRoot = (path: string, root: string) =>
    path === root || path.startsWith(root + '/');
  const pathname = request.nextUrl.pathname;
  const isCronPath = pathMatchesRoot(pathname, '/api/cron');

  if (isCronPath) {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get('authorization');
    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  // Match only the intended API roots and their descendants.
  const apiPublicPathMatch = (path: string) => {
    return ['/api/cron', '/api/public'].some((publicPath) => pathMatchesRoot(path, publicPath));
  };

  // Match public pages exactly or below their path, without treating '/' as a global prefix.
  const prefixPublicPathMatch = (path: string) => {
    return publicPaths.some(
      (publicPath) =>
        publicPath === path || (publicPath !== '/' && path.startsWith(publicPath + '/'))
    );
  };

  const isPublicPath =
    apiPublicPathMatch(request.nextUrl.pathname) || prefixPublicPathMatch(request.nextUrl.pathname);

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

  if (user && !request.nextUrl.pathname.startsWith('/api/')) {
    if (user.role === 'billing') {
      const canAccess = billingAllowedPrefixes.some(
        (path) =>
          request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/')
      );
      if (!canAccess) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/settings/billing';
        return NextResponse.redirect(url);
      }
    }
    if (user.role === 'member') {
      const blocked = memberBlockedPrefixes.some(
        (path) =>
          request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/')
      );
      if (blocked) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
