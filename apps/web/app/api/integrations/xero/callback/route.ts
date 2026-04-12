import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/integrations/xero/callback
 * Handles Xero OAuth2 callback — exchanges code for tokens and stores in Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const returnedState = searchParams.get('state');

  // Validate CSRF state
  const storedState = request.cookies.get('xero_oauth_state')?.value;
  if (!storedState || returnedState !== storedState) {
    const appBase2 = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : 'https://ccw-crm-web.vercel.app';
    return NextResponse.redirect(`${appBase2}/settings/integrations?xero_error=invalid_state`);
  }

  const appBase = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'https://ccw-crm-web.vercel.app';

  if (error) {
    return NextResponse.redirect(
      `${appBase}/settings/integrations?xero_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${appBase}/settings/integrations?xero_error=missing_code`);
  }

  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = process.env.XERO_REDIRECT_URI || `${appBase}/api/integrations/xero/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appBase}/settings/integrations?xero_error=not_configured`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Xero token exchange failed:', err);
      return NextResponse.redirect(
        `${appBase}/settings/integrations?xero_error=token_exchange_failed`
      );
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
      scope?: string;
    };

    // Get connected tenants
    const tenantsRes = await fetch('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const tenants = (await tenantsRes.json()) as Array<{
      tenantId: string;
      tenantName: string;
    }>;
    const tenant = tenants[0];

    if (!tenant) {
      return NextResponse.redirect(`${appBase}/settings/integrations?xero_error=no_tenant`);
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store in Supabase
    const supabase = createServerClient();
    const { error: dbError } = await supabase.from('xero_connections').upsert(
      {
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

    if (dbError) {
      console.error('Supabase upsert failed:', dbError);
      return NextResponse.redirect(`${appBase}/settings/integrations?xero_error=db_error`);
    }

    return NextResponse.redirect(
      `${appBase}/settings/integrations?xero_success=true&tenant=${encodeURIComponent(tenant.tenantName)}`
    );
  } catch (e) {
    console.error('Xero callback error:', e);
    return NextResponse.redirect(
      `${appBase}/settings/integrations?xero_error=${encodeURIComponent(String(e))}`
    );
  }
}
