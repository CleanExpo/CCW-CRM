import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getXeroMode, resolveXeroRedirectUri } from '@/lib/integrations/xero';
import {
  applyXeroSessionCookies,
  clearXeroOAuthStateCookie,
  exchangeXeroAuthorizationCode,
  fetchXeroTenantConnections,
  parseXeroOAuthError,
  verifyXeroOAuthState,
} from '@/lib/integrations/xero-oauth';
import { saveWorkspaceXeroConnection } from '@/lib/integrations/xero-storage';

const SETTINGS_URL = '/dashboard/settings/integrations';

export async function GET(request: NextRequest) {
  const mode = getXeroMode();
  if (mode !== 'live') {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}?xero_success=true&mode=demo`, request.url));
  }

  const oauthError = request.nextUrl.searchParams.get('error');
  if (oauthError) {
    const description = parseXeroOAuthError(
      oauthError,
      request.nextUrl.searchParams.get('error_description')
    );
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?xero_error=${encodeURIComponent(description)}`, request.url)
    );
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  if (!code) {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?xero_error=${encodeURIComponent('Missing OAuth authorization code from Xero.')}`,
        request.url
      )
    );
  }

  if (!verifyXeroOAuthState(request, state)) {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?xero_error=${encodeURIComponent('OAuth state mismatch — try Connect again (session may have expired).')}`,
        request.url
      )
    );
  }

  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?xero_error=${encodeURIComponent('You must be logged in to complete Xero connection.')}`,
        request.url
      )
    );
  }

  const redirectUri = resolveXeroRedirectUri(request);
  if (!redirectUri) {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?xero_error=${encodeURIComponent('Xero redirect URI is not configured on the server.')}`,
        request.url
      )
    );
  }

  try {
    const tokens = await exchangeXeroAuthorizationCode(code, redirectUri);
    const connections = await fetchXeroTenantConnections(tokens.accessToken);
    if (connections.length === 0) {
      throw new Error('No Xero organisation is linked to this app. Authorise at least one organisation in Xero.');
    }

    const preferredTenantId = request.nextUrl.searchParams.get('tenant_id')?.trim();
    const tenant =
      (preferredTenantId
        ? connections.find((c) => c.tenantId === preferredTenantId)
        : null) ?? connections[0];

    const workspaceId = await getWorkspaceIdForUser(scope.userId);
    if (workspaceId) {
      await saveWorkspaceXeroConnection({
        workspaceId,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        tokens,
        connectedByUserId: scope.userId,
      });
    }

    const redirect = NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?xero_success=true&tenant=${encodeURIComponent(tenant.tenantName)}&mode=live`,
        request.url
      )
    );
    applyXeroSessionCookies(redirect, tokens, tenant.tenantId);
    clearXeroOAuthStateCookie(redirect);
    return redirect;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Xero callback failed';
    const res = NextResponse.redirect(
      new URL(`${SETTINGS_URL}?xero_error=${encodeURIComponent(message)}`, request.url)
    );
    clearXeroOAuthStateCookie(res);
    return res;
  }
}
