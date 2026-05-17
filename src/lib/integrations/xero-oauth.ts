import { randomUUID } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { getXeroClientId, getXeroClientSecret } from '@/lib/integrations/xero';

export const XERO_OAUTH_STATE_COOKIE = 'xero_oauth_state';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const CONNECTIONS_URL = 'https://api.xero.com/connections';

export type XeroTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date | null;
  scope?: string;
};

export type XeroTenantConnection = {
  tenantId: string;
  tenantName: string;
  tenantType?: string;
};

export function createXeroOAuthState(): string {
  return randomUUID();
}

export function setXeroOAuthStateCookie(response: NextResponse, state: string): void {
  response.cookies.set(XERO_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });
}

export function clearXeroOAuthStateCookie(response: NextResponse): void {
  response.cookies.set(XERO_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function verifyXeroOAuthState(request: NextRequest, state: string | null): boolean {
  if (!state?.trim()) return false;
  const expected = request.cookies.get(XERO_OAUTH_STATE_COOKIE)?.value?.trim();
  return Boolean(expected && expected === state.trim());
}

export function parseXeroOAuthError(
  error: string | null,
  errorDescription: string | null
): string {
  if (errorDescription?.trim()) return errorDescription.trim();
  if (error === 'access_denied') return 'You declined access in Xero. Try Connect again and approve the app.';
  if (error === 'invalid_request') {
    return 'Invalid OAuth request — usually a redirect URI mismatch. Register the exact Redirect URI shown in Settings → Integrations → Xero.';
  }
  if (error?.trim()) return `Xero OAuth error: ${error}`;
  return 'Xero authorization was cancelled or failed.';
}

function mapTokenResponse(json: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}): XeroTokenSet {
  if (!json.access_token?.trim()) {
    throw new Error('Xero token response did not include an access token.');
  }
  const expiresAt =
    typeof json.expires_in === 'number' && json.expires_in > 0
      ? new Date(Date.now() + json.expires_in * 1000)
      : null;
  return {
    accessToken: json.access_token.trim(),
    refreshToken: json.refresh_token?.trim() || undefined,
    expiresAt,
    scope: json.scope,
  };
}

async function postToken(body: URLSearchParams): Promise<XeroTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text().catch(() => '');
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const detail =
      typeof json.error_description === 'string'
        ? json.error_description
        : typeof json.error === 'string'
          ? json.error
          : text.slice(0, 300);
    throw new Error(`Xero token request failed (${res.status}): ${detail || 'unknown error'}`);
  }
  return mapTokenResponse(json as Parameters<typeof mapTokenResponse>[0]);
}

export async function exchangeXeroAuthorizationCode(
  code: string,
  redirectUri: string
): Promise<XeroTokenSet> {
  return postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: getXeroClientId(),
      client_secret: getXeroClientSecret(),
    })
  );
}

export async function refreshXeroAccessToken(refreshToken: string): Promise<XeroTokenSet> {
  return postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: getXeroClientId(),
      client_secret: getXeroClientSecret(),
    })
  );
}

export async function fetchXeroTenantConnections(
  accessToken: string
): Promise<XeroTenantConnection[]> {
  const res = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to list Xero organisations (${res.status}): ${text.slice(0, 200)}`);
  }
  const rows = (await res.json()) as Array<{
    tenantId?: string;
    tenantName?: string;
    tenantType?: string;
  }>;
  return rows
    .filter((r) => r.tenantId)
    .map((r) => ({
      tenantId: r.tenantId!,
      tenantName: r.tenantName?.trim() || r.tenantId!,
      tenantType: r.tenantType,
    }));
}

export function applyXeroSessionCookies(
  response: NextResponse,
  tokens: XeroTokenSet,
  tenantId: string
): void {
  const secure = process.env.NODE_ENV === 'production';
  const accessMaxAge = tokens.expiresAt
    ? Math.max(60, Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000))
    : 60 * 30;

  response.cookies.set('xero_access_token', tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: accessMaxAge,
  });
  if (tokens.refreshToken) {
    response.cookies.set('xero_refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: 60 * 60 * 24 * 60,
    });
  }
  response.cookies.set('xero_tenant_id', tenantId, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 60,
  });
}

export function clearXeroSessionCookies(response: NextResponse): void {
  const clear = { path: '/', maxAge: 0 };
  response.cookies.set('xero_access_token', '', clear);
  response.cookies.set('xero_refresh_token', '', clear);
  response.cookies.set('xero_tenant_id', '', clear);
}
