import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface XeroTenant {
  tenantId: string;
  tenantName: string;
  tenantType: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ccw-crm-web.vercel.app';

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?xero_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !returnedState) {
    return NextResponse.redirect(`${baseUrl}/settings/integrations?xero_error=missing_params`);
  }

  // CSRF: validate state cookie
  const cookieStore = await cookies();
  const savedState = cookieStore.get('xero_oauth_state')?.value;

  if (!savedState || savedState !== returnedState) {
    return NextResponse.redirect(`${baseUrl}/settings/integrations?xero_error=invalid_state`);
  }

  // Clear the state cookie
  cookieStore.delete('xero_oauth_state');

  const clientId = process.env.XERO_CLIENT_ID!;
  const clientSecret = process.env.XERO_CLIENT_SECRET!;
  const redirectUri = process.env.XERO_REDIRECT_URI!;

  try {
    // Exchange code for tokens
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} — ${text}`);
    }

    const tokens = (await tokenResponse.json()) as XeroTokenResponse;
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Get connected tenants (organisations)
    const tenantsResponse = await fetch('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!tenantsResponse.ok) {
      throw new Error(`Failed to fetch Xero tenants: ${tenantsResponse.status}`);
    }

    const tenants = (await tenantsResponse.json()) as XeroTenant[];

    if (!tenants.length) {
      return NextResponse.redirect(`${baseUrl}/settings/integrations?xero_error=no_tenants`);
    }

    const primaryTenant = tenants[0];

    // Persist tokens in Supabase
    const supabase = createServerClient();

    const { error: upsertError } = await supabase.from('xero_connections').upsert(
      {
        tenant_id: primaryTenant.tenantId,
        tenant_name: primaryTenant.tenantName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    );

    if (upsertError) throw new Error(upsertError.message);

    const redirectUrl = `${baseUrl}/settings/integrations?xero_success=true&tenant=${encodeURIComponent(primaryTenant.tenantName)}`;
    return NextResponse.redirect(redirectUrl);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      `${baseUrl}/settings/integrations?xero_error=${encodeURIComponent(message)}`
    );
  }
}
