import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  buildXeroAuthorizeUrl,
  getXeroMode,
  hasLiveClientCredentials,
  resolveXeroRedirectUri,
} from '@/lib/integrations/xero';
import { createXeroOAuthState, setXeroOAuthStateCookie } from '@/lib/integrations/xero-oauth';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const mode = getXeroMode();
  if (mode === 'demo') {
    return NextResponse.json({
      mode: 'demo',
      authorization_url: '',
      state: 'demo-state',
      instructions: 'Demo mode active. Set XERO_MODE=live to enable real OAuth.',
    });
  }

  if (!hasLiveClientCredentials()) {
    return NextResponse.json(
      { detail: 'Missing Xero client credentials or redirect URI.' },
      { status: 503 }
    );
  }

  const redirectUri = resolveXeroRedirectUri(request);
  if (!redirectUri) {
    return NextResponse.json(
      {
        detail:
          'Could not determine Xero redirect URI. Set XERO_REDIRECT_URI and/or XERO_REDIRECT_URI_LOCAL and register them in the Xero Developer Portal.',
      },
      { status: 503 }
    );
  }

  const state = createXeroOAuthState();
  const authorizationUrl = buildXeroAuthorizeUrl(state, request);
  const res = NextResponse.json({
    mode: 'live',
    authorization_url: authorizationUrl,
    redirect_uri: redirectUri,
    state,
  });
  setXeroOAuthStateCookie(res, state);
  return res;
}
