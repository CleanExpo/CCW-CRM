import type { NextRequest } from 'next/server';

export type XeroMode = 'demo' | 'live';

export function getXeroMode(): XeroMode {
  return process.env.XERO_MODE === 'live' ? 'live' : 'demo';
}

export function getXeroScopes(): string {
  return (
    process.env.XERO_SCOPES?.trim() ||
    'openid profile email offline_access accounting.transactions accounting.contacts'
  );
}

export function getXeroClientId(): string {
  return process.env.XERO_CLIENT_ID?.trim() || '';
}

export function getXeroClientSecret(): string {
  return process.env.XERO_CLIENT_SECRET?.trim() || '';
}

/** Normalize so trailing slashes don’t break OAuth (Xero matches redirect URIs exactly). */
export function normalizeXeroRedirectUri(uri: string): string {
  const t = uri.trim();
  if (!t) return '';
  try {
    const u = new URL(t);
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return t.replace(/\/+$/, '');
  }
}

/** Production / primary OAuth redirect (must be registered in your Xero app). */
export function getXeroRedirectUri(): string {
  return normalizeXeroRedirectUri(process.env.XERO_REDIRECT_URI?.trim() || '');
}

/** Optional second redirect for local dev (`http://localhost:3000/...`) — register both URIs in Xero. */
export function getXeroRedirectUriLocal(): string {
  return normalizeXeroRedirectUri(process.env.XERO_REDIRECT_URI_LOCAL?.trim() || '');
}

/**
 * Pick the redirect URI that matches how the user reached this app (authorize vs callback).
 * Token exchange must use the same redirect_uri as the authorize request.
 */
export function resolveXeroRedirectUri(request: NextRequest): string {
  const primary = getXeroRedirectUri();
  const local = getXeroRedirectUriLocal();
  const origin = request.nextUrl.origin;

  const matchesOrigin = (uri: string) => {
    if (!uri) return false;
    try {
      return new URL(uri).origin === origin;
    } catch {
      return false;
    }
  };

  if (local && matchesOrigin(local)) return local;
  if (primary && matchesOrigin(primary)) return primary;
  if (primary) return primary;
  if (local) return local;
  return '';
}

export function getConfiguredTokenSource(request?: NextRequest): {
  accessToken: string;
  refreshToken?: string;
  tenantId: string;
} | null {
  const envAccess = process.env.XERO_ACCESS_TOKEN?.trim();
  const envRefresh = process.env.XERO_REFRESH_TOKEN?.trim();
  const envTenant = process.env.XERO_TENANT_ID?.trim();
  if (envAccess && envTenant) {
    return { accessToken: envAccess, refreshToken: envRefresh || undefined, tenantId: envTenant };
  }

  if (!request) return null;
  const accessToken = request.cookies.get('xero_access_token')?.value?.trim();
  const refreshToken = request.cookies.get('xero_refresh_token')?.value?.trim();
  const tenantId = request.cookies.get('xero_tenant_id')?.value?.trim();
  if (!accessToken || !tenantId) return null;
  return { accessToken, refreshToken: refreshToken || undefined, tenantId };
}

export function hasLiveClientCredentials(): boolean {
  const redirectOk =
    Boolean(getXeroRedirectUri()) || Boolean(getXeroRedirectUriLocal());
  return Boolean(getXeroClientId() && getXeroClientSecret() && redirectOk);
}

/** Resolve organisation name for the connected tenant (falls back to null on error). */
export async function fetchXeroOrganisationName(
  accessToken: string,
  tenantId: string
): Promise<string | null> {
  const res = await fetch('https://api.xero.com/api.xro/2.0/Organisation', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Xero-tenant-id': tenantId,
    },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    Organisations?: Array<{ Name?: string }>;
  };
  const name = data.Organisations?.[0]?.Name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export function buildXeroAuthorizeUrl(state: string, request?: NextRequest): string {
  const redirectUri = request
    ? resolveXeroRedirectUri(request)
    : getXeroRedirectUri() || getXeroRedirectUriLocal();
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: getXeroClientId(),
    redirect_uri: redirectUri,
    scope: getXeroScopes(),
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${q.toString()}`;
}

