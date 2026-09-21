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

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((path) => pathname === path || pathname.startsWith(path + '/'));
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

  // The same role rules for the API routes behind those pages. Pages redirect;
  // APIs answer 403 JSON. Each entry is only called from a page the role is
  // blocked from above. APIs the role's own pages call stay open.
  const memberBlockedApiPrefixes = [
    // settings/company, settings/team, settings/billing
    '/api/settings',
    '/api/team',
    '/api/billing',
    // Cin7 repair tools on settings/integrations
    '/api/integrations/cin7/cleanup-duplicates',
    '/api/integrations/cin7/stock-prune',
    '/api/integrations/cin7/stock-freeze',
    '/api/integrations/cin7/field-heal',
    '/api/integrations/cin7/product-heal',
    '/api/integrations/cin7/scheduled-sync',
    '/api/integrations/cin7/heal-audit',
    // /approvals
    '/api/approvals',
    // /alerts and /monitoring
    '/api/monitoring',
    // /dashboard/finance pages only (invoices and bank-feeds are shared with operations)
    '/api/trade-finance',
    '/api/bank-reconciliation',
    '/api/reconciliation',
  ];
  const memberAllowedApiPrefixes = [
    // POS failure count on the /dashboard home page
    '/api/monitoring/alerts/pos-failures',
    // Accepting an invite is not team management
    '/api/team/invite/accept',
  ];
  // Billing can open every /dashboard page (see '/dashboard' above), so only
  // the /monitoring page is out of reach; /dashboard/alerts stays reachable.
  const billingBlockedApiPrefixes = ['/api/monitoring'];
  const billingAllowedApiPrefixes = ['/api/monitoring/alerts'];

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

  // Middleware sees the raw path, but Next.js decodes it before choosing a
  // route, so /api/settings%2Fcompany is served by /api/settings/company. Role
  // rules therefore match the decoded path, and a path that cannot be decoded
  // is refused rather than passed through unchecked.
  let decodedPath = request.nextUrl.pathname;
  try {
    decodedPath = decodeURIComponent(decodedPath);
  } catch {
    if (user) return NextResponse.json({ detail: 'Malformed request path' }, { status: 400 });
  }

  if (user && decodedPath.startsWith('/api/')) {
    const pathname = decodedPath;
    const blocked =
      (user.role === 'member' &&
        matchesPrefix(pathname, memberBlockedApiPrefixes) &&
        !matchesPrefix(pathname, memberAllowedApiPrefixes)) ||
      (user.role === 'billing' &&
        matchesPrefix(pathname, billingBlockedApiPrefixes) &&
        !matchesPrefix(pathname, billingAllowedApiPrefixes));
    if (blocked) {
      return NextResponse.json(
        { detail: 'Your role does not have access to this resource' },
        { status: 403 }
      );
    }
  }

  if (user && !decodedPath.startsWith('/api/')) {
    if (user.role === 'billing') {
      const canAccess = billingAllowedPrefixes.some(
        (path) => decodedPath === path || decodedPath.startsWith(path + '/')
      );
      if (!canAccess) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard/settings/billing';
        return NextResponse.redirect(url);
      }
    }
    if (user.role === 'member') {
      const blocked = memberBlockedPrefixes.some(
        (path) => decodedPath === path || decodedPath.startsWith(path + '/')
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
