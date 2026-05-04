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

export function getXeroRedirectUri(): string {
  return process.env.XERO_REDIRECT_URI?.trim() || '';
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
  return Boolean(getXeroClientId() && getXeroClientSecret() && getXeroRedirectUri());
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

export function buildXeroAuthorizeUrl(state: string): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: getXeroClientId(),
    redirect_uri: getXeroRedirectUri(),
    scope: getXeroScopes(),
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${q.toString()}`;
}

