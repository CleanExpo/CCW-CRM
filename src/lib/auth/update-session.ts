/**
 * Next.js middleware session gate: verify access JWT from cookie (Edge).
 */

import { verifyAuthAccessJwt } from '@/lib/auth/jwt-tokens';
import { AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from '@/lib/auth/session-cookies';
import { NextResponse, type NextRequest } from 'next/server';

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

  const cookieToken = request.cookies.get(AUTH_ACCESS_COOKIE)?.value;

  let user: SessionUser | null = null;
  if (cookieToken) {
    user = await userFromAccessToken(cookieToken);

    if (!user) {
      response.cookies.delete(AUTH_ACCESS_COOKIE);
      response.cookies.delete(AUTH_REFRESH_COOKIE);
    }
  }

  // API clients (browser fetch + in-process Cin7 walk) send Authorization: Bearer.
  // Cookie-only gating turns those into /login HTML 200s. JWTs contain `.`; cron
  // secrets typically do not, so Bearer CRON_SECRET still falls through to the
  // public `/api/cron` prefix or the route's own cron check.
  if (!user && request.nextUrl.pathname.startsWith('/api/')) {
    const auth = request.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      const candidate = auth.slice(7).trim();
      if (candidate.includes('.')) {
        user = await userFromAccessToken(candidate);
      }
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
    '/api/cron',
    '/api/auth',
    '/api/webhooks',
    '/api/public',
    // OAuth redirects must load without a prior session (provider sends user back to callback).
    '/api/integrations/xero/callback',
    '/api/integrations/xero/auth',
    '/api/integrations/shopify/callback',
    '/api/integrations/shopify/authorize',
  ];
  // Exact-only: do not prefix-match /api/health/deep or /api/health/routes.
  // Monitors that follow redirects must see real JSON health, not a login HTML 200.
  const publicExactPaths = new Set(['/api/health']);
  const isPublicPath =
    publicExactPaths.has(request.nextUrl.pathname) ||
    publicPaths.some(
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
