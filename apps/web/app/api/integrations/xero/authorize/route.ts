import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * GET /api/integrations/xero/authorize
 * Returns Xero OAuth2 authorization URL.
 * Requires XERO_CLIENT_ID and XERO_REDIRECT_URI in Vercel env vars.
 */
export async function GET() {
  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri =
    process.env.XERO_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'https://ccw-crm-web.vercel.app'}/api/integrations/xero/callback`;

  if (!clientId) {
    return NextResponse.json(
      {
        detail: 'XERO_CLIENT_ID not configured. Contact CCW support to enable Xero integration.',
      },
      { status: 503 }
    );
  }

  const state = crypto.randomBytes(16).toString('hex');
  const scopes = [
    'openid',
    'profile',
    'email',
    'accounting.transactions',
    'accounting.contacts',
    'accounting.settings',
    'offline_access',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });

  const authorizationUrl = `https://login.xero.com/identity/connect/authorize?${params}`;

  return NextResponse.json({
    mode: 'live',
    authorization_url: authorizationUrl,
    state,
  });
}
