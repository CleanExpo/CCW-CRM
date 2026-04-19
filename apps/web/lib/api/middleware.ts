/**
 * JWT Authentication Middleware
 *
 * Validates JWT tokens and handles protected routes.
 */

import { NextResponse, type NextRequest } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface User {
  id: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
}

/**
 * Verify JWT token with backend.
 *
 * Uses a 3s AbortController timeout so a slow/OOM'd backend cannot hang
 * the middleware and poison Next.js RSC prefetches with 503s (UNI-1789).
 */
async function verifyToken(token: string): Promise<User | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Update session and handle authentication
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  // Get auth token from cookies
  const token = request.cookies.get('auth_token')?.value;

  // RSC prefetch fast-path (UNI-1789): Next.js fires ?_rsc=* prefetches on
  // link hover. Don't round-trip to the backend for those — if the user has
  // a token cookie, let the prefetch through and let the client-rendered
  // page do its own auth check on mount. Pages without a token still
  // redirect to /login below.
  const isRscPrefetch = request.nextUrl.searchParams.has('_rsc');
  if (isRscPrefetch && token) {
    return response;
  }

  // Verify token if present
  let user: User | null = null;
  if (token) {
    user = await verifyToken(token);

    // Clear invalid token
    if (!user) {
      response.cookies.delete('auth_token');
    }
  }

  // Protected routes — all paths except explicitly public ones require authentication
  // Note: /api/cron routes use their own CRON_SECRET auth, not session cookies
  const publicPaths = ['/login', '/register', '/guest', '/faq', '/', '/api/cron', '/api/auth'];
  const isPublicPath = publicPaths.some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/')
  );

  if (!isPublicPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Redirect logged in users away from auth pages
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
