import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import {
  fetchXeroOrganisationName,
  getXeroMode,
  hasLiveClientCredentials,
  listXeroRegisteredRedirectUris,
  resolveXeroRedirectUri,
} from '@/lib/integrations/xero';
import { getValidXeroTokens } from '@/lib/integrations/xero-tokens';
import { isXeroTokenExpired } from '@/lib/integrations/xero-storage';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const mode = getXeroMode();
  const oauth_redirect_uri = resolveXeroRedirectUri(request);
  const registered_redirect_uris = listXeroRegisteredRedirectUris();

  if (mode === 'demo') {
    return NextResponse.json({
      connected: true,
      mode: 'demo',
      tenant_name: 'Demo Organization',
      tenant_id: 'demo-tenant',
      oauth_redirect_uri,
      registered_redirect_uris,
      message: 'Demo mode active. No real Xero API calls are made.',
    });
  }

  if (!hasLiveClientCredentials()) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      oauth_redirect_uri,
      registered_redirect_uris,
      setup_steps: buildSetupSteps(false, oauth_redirect_uri),
      message: 'Missing Xero OAuth credentials in environment.',
    });
  }

  const tokens = await getValidXeroTokens(request, scope.userId);
  if (!tokens) {
    return NextResponse.json({
      connected: false,
      mode: 'live',
      oauth_redirect_uri,
      registered_redirect_uris,
      setup_steps: buildSetupSteps(true, oauth_redirect_uri),
      message: 'Not connected. Click Connect to Xero to link your organisation.',
    });
  }

  const displayName =
    (await fetchXeroOrganisationName(tokens.accessToken, tokens.tenantId)) ??
    tokens.tenantName ??
    tokens.tenantId;

  const token_expires_soon =
    tokens.expiresAt != null && isXeroTokenExpired(tokens.expiresAt, 60 * 15);

  return NextResponse.json({
    connected: true,
    mode: 'live',
    tenant_id: tokens.tenantId,
    tenant_name: displayName,
    token_source: tokens.source,
    token_expires_at: tokens.expiresAt?.toISOString() ?? null,
    token_expires_soon,
    oauth_redirect_uri,
    registered_redirect_uris,
  });
}

function buildSetupSteps(credentialsOk: boolean, redirectUri: string | null) {
  return [
    {
      id: 'credentials',
      label: 'Set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_MODE=live',
      done: credentialsOk,
    },
    {
      id: 'redirect',
      label: redirectUri
        ? `Register Redirect URI in Xero Developer Portal: ${redirectUri}`
        : 'Configure XERO_REDIRECT_URI (and XERO_REDIRECT_URI_LOCAL for localhost)',
      done: Boolean(redirectUri),
    },
    {
      id: 'connect',
      label: 'Click Connect to Xero and approve access',
      done: false,
    },
  ];
}
