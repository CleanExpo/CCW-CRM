import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  buildXeroAuthorizeUrl,
  getXeroMode,
  hasLiveClientCredentials,
} from '@/lib/integrations/xero';

const SETTINGS_URL = '/dashboard/settings/integrations';

/**
 * Browser-friendly OAuth kick-off (same intent as GET /xero/authorize JSON).
 * Used by onboarding flows that navigate directly to this URL.
 */
export async function GET(request: NextRequest) {
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

  const authorizationUrl = buildXeroAuthorizeUrl(randomUUID(), request);
  return NextResponse.redirect(authorizationUrl);
}
