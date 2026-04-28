import { NextRequest } from 'next/server';
import { AUTH_REFRESH_COOKIE, setAuthSessionCookies } from '@/lib/auth/session-cookies';
import { jsonDetail, jsonOk } from '@/lib/auth/http';
import { verifyRefreshJwt, signTokenPair } from '@/lib/auth/jwt-tokens';
import { findAppUserById } from '@/lib/auth/app-user-repo';

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(AUTH_REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return jsonDetail('No refresh session', 401);
  }

  try {
    const claims = await verifyRefreshJwt(refreshToken);
    if (!claims) {
      return jsonDetail('Invalid or expired refresh session', 401);
    }

    const row = await findAppUserById(claims.sub);
    if (!row || !row.isActive || row.email.toLowerCase() !== claims.email.toLowerCase()) {
      return jsonDetail('Invalid or expired refresh session', 401);
    }

    const tokens = await signTokenPair(row.id, row.email, row.isAdmin, row.role);
    const response = jsonOk({
      access_token: tokens.access_token,
      token_type: 'bearer',
    });
    setAuthSessionCookies(response, tokens);
    return response;
  } catch (e) {
    console.error('[auth/refresh]', e);
    return jsonDetail('Refresh service unavailable', 503);
  }
}
