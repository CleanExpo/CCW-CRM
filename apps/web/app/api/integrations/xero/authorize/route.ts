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

  // Granular scopes required for apps created after March 2026.
  // accounting.transactions is deprecated — use granular equivalents.
  const scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'accounting.contacts',
    'accounting.settings',
    'accounting.invoices',
    'accounting.payments',
    'accounting.banktransactions',
    'accounting.manualjournals',
  ].join(' ');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });

  const authorizationUrl = `https://login.xero.com/identity/connect/authorize?${params}`;

  // Store state in cookie for CSRF validation in callback
  const response = NextResponse.json({
    mode: 'live',
    authorization_url: authorizationUrl,
    state,
  });
  response.cookies.set('xero_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });
  return response;
}
