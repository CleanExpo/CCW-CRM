import { NextRequest, NextResponse } from 'next/server';
import {
  getXeroClientId,
  getXeroClientSecret,
  getXeroMode,
  resolveXeroRedirectUri,
} from '@/lib/integrations/xero';

const SETTINGS_URL = '/dashboard/settings/integrations';

export async function GET(request: NextRequest) {
  const mode = getXeroMode();
  if (mode !== 'live') {
    return NextResponse.redirect(new URL(`${SETTINGS_URL}?xero_success=true&mode=demo`, request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    const err = request.nextUrl.searchParams.get('error_description') || 'Missing OAuth code';
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?xero_error=${encodeURIComponent(err)}`, request.url)
    );
  }

  try {
    const tokenRes = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: resolveXeroRedirectUri(request),
        client_id: getXeroClientId(),
        client_secret: getXeroClientSecret(),
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => '');
      throw new Error(`Token exchange failed (${tokenRes.status}): ${detail.slice(0, 200)}`);
    }

    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
    };

    const connRes = await fetch('https://api.xero.com/connections', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
      },
    });
    if (!connRes.ok) {
      throw new Error(`Failed to read tenant connections (${connRes.status})`);
    }
    const connections = (await connRes.json()) as Array<{ tenantId: string; tenantName: string }>;
    const tenant = connections[0];
    if (!tenant?.tenantId) {
      throw new Error('No tenant found in Xero connections');
    }

    const redirect = NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?xero_success=true&tenant=${encodeURIComponent(tenant.tenantName || tenant.tenantId)}&mode=live`,
        request.url
      )
    );
    redirect.cookies.set('xero_access_token', tokenJson.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60,
    });
    if (tokenJson.refresh_token) {
      redirect.cookies.set('xero_refresh_token', tokenJson.refresh_token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    redirect.cookies.set('xero_tenant_id', tenant.tenantId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return redirect;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Xero callback failed';
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?xero_error=${encodeURIComponent(message)}`, request.url)
    );
  }
}

