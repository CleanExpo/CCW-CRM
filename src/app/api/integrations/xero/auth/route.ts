import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  buildXeroAuthorizeUrl,
  getXeroMode,
  hasLiveClientCredentials,
  resolveXeroRedirectUri,
} from '@/lib/integrations/xero';
import { createXeroOAuthState, setXeroOAuthStateCookie } from '@/lib/integrations/xero-oauth';

const SETTINGS_URL = '/dashboard/settings/integrations';

/**
 * Browser-friendly OAuth kick-off (redirects to Xero with CSRF state cookie).
 */
export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?xero_error=${encodeURIComponent('Log in before connecting Xero.')}`,
        request.url
      )
    );
  }

  const mode = getXeroMode();
  if (mode !== 'live') {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}?xero_success=true&mode=demo`, request.url));
  }

  if (!hasLiveClientCredentials()) {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?xero_error=${encodeURIComponent('Missing Xero client credentials or redirect URI.')}`,
        request.url
      )
    );
  }

  const redirectUri = resolveXeroRedirectUri(request);
  if (!redirectUri) {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?xero_error=${encodeURIComponent('Xero redirect URI is not configured.')}`,
        request.url
      )
    );
  }

  const state = createXeroOAuthState();
  const res = NextResponse.redirect(buildXeroAuthorizeUrl(state, request));
  setXeroOAuthStateCookie(res, state);
  return res;
}
