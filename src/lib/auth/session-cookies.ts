import { NextResponse } from 'next/server';

export const AUTH_ACCESS_COOKIE = 'auth_token';
export const AUTH_REFRESH_COOKIE = 'auth_refresh';

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function maxAgeFromAccessToken(accessToken: string): number {
  try {
    const part = accessToken.split('.')[1];
    if (!part) return 3600;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    ) as { exp?: number };
    if (!json.exp) return 3600;
    const sec = json.exp - Math.floor(Date.now() / 1000);
    return Math.max(60, Math.min(sec, 60 * 60 * 24 * 7));
  } catch {
    return 3600;
  }
}

export interface AuthTokenPair {
  access_token: string;
  refresh_token: string;
}

export function setAuthSessionCookies(response: NextResponse, tokens: AuthTokenPair): void {
  const maxAge = maxAgeFromAccessToken(tokens.access_token);
  response.cookies.set(AUTH_ACCESS_COOKIE, tokens.access_token, {
    ...cookieBase,
    maxAge,
  });
  response.cookies.set(AUTH_REFRESH_COOKIE, tokens.refresh_token, {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(AUTH_ACCESS_COOKIE, '', { ...cookieBase, maxAge: 0 });
  response.cookies.set(AUTH_REFRESH_COOKIE, '', { ...cookieBase, maxAge: 0 });
}
