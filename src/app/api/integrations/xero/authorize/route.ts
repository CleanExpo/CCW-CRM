import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const XERO_SCOPES = [
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

export async function GET() {
  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { detail: 'XERO_CLIENT_ID and XERO_REDIRECT_URI must be set in environment variables.' },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(32).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: XERO_SCOPES,
    state,
  });

  const authorizationUrl = `https://login.xero.com/identity/connect/authorize?${params.toString()}`;

  // Store state in httpOnly cookie for CSRF validation in callback
  const cookieStore = await cookies();
  cookieStore.set('xero_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return NextResponse.json({
    mode: 'live',
    authorization_url: authorizationUrl,
    state,
  });
}
