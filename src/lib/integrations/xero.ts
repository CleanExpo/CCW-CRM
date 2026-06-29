import type { NextRequest } from 'next/server';

export type XeroMode = 'demo' | 'live';

export function getXeroMode(): XeroMode {
  return process.env.XERO_MODE === 'live' ? 'live' : 'demo';
}

export function getXeroScopes(): string {
  return (
    process.env.XERO_SCOPES?.trim() ||
    'offline_access accounting.transactions accounting.contacts accounting.settings'
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

/** Canonical OAuth callback path (Next.js Route Handler). */
export const XERO_OAUTH_CALLBACK_PATH = '/api/integrations/xero/callback';

/** Build redirect URI for the host the user is actually using (scheme + host must match Xero app config). */
export function buildXeroRedirectUriForOrigin(origin: string): string {
  const base = origin.trim().replace(/\/$/, '');
  if (!base) return '';
  return normalizeXeroRedirectUri(`${base}${XERO_OAUTH_CALLBACK_PATH}`);
}

/**
 * Pick the redirect URI for authorize + token exchange.
 * Uses env URIs when their origin matches the current request; otherwise uses the request origin
 * so localhost / preview hosts work once registered in the Xero Developer Portal.
 */
export function resolveXeroRedirectUri(request: NextRequest): string {
  const origin = request.nextUrl.origin;
  const fromRequest = buildXeroRedirectUriForOrigin(origin);
  const primary = getXeroRedirectUri();
  const local = getXeroRedirectUriLocal();

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

  // Dev / staging / www vs apex: use the URI for this browser origin (must be whitelisted in Xero).
  if (fromRequest) return fromRequest;

  return primary || local || '';
}

/** All redirect URIs configured in env (register each in the Xero Developer Portal). */
export function listXeroRegisteredRedirectUris(): string[] {
  const uris = [getXeroRedirectUri(), getXeroRedirectUriLocal()].filter(Boolean);
  return [...new Set(uris)];
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
    : getXeroRedirectUri() ||
      getXeroRedirectUriLocal() ||
      buildXeroRedirectUriForOrigin(process.env.NEXT_PUBLIC_FRONTEND_URL?.trim() || 'http://localhost:3000');

  if (!redirectUri) {
    throw new Error(
      'Xero redirect URI is not configured. Set XERO_REDIRECT_URI or open the app from your registered domain.'
    );
  }

  const q = new URLSearchParams({
    response_type: 'code',
    client_id: getXeroClientId(),
    redirect_uri: redirectUri,
    scope: getXeroScopes(),
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${q.toString()}`;
}

