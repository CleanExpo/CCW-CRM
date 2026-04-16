import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/integrations/xero/refresh
 * Refreshes the Xero access token using the stored refresh token.
 * Xero tokens expire every 30 minutes. Refresh tokens are rotated on each use.
 * Called automatically by the embedding cron or before any Xero API call.
 */
export async function POST() {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ detail: 'Xero not configured.' }, { status: 503 });
  }

  try {
    const supabase = createServerClient();

    const { data: conn, error: fetchError } = await supabase
      .from('xero_connections')
      .select('id, refresh_token, tenant_id')
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!conn) {
      return NextResponse.json({ detail: 'No active Xero connection.' }, { status: 404 });
    }

    // Exchange refresh token for new access + refresh tokens
    const tokenRes = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: conn.refresh_token,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      // If refresh fails, mark connection inactive (user must re-authorise)
      await supabase
        .from('xero_connections')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', conn.id);

      return NextResponse.json(
        { detail: `Token refresh failed: ${err}. Please reconnect Xero.` },
        { status: 401 }
      );
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope?: string;
    };

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store new tokens — refresh token rotates on every use
    const { error: updateError } = await supabase
      .from('xero_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', conn.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      expires_at: expiresAt,
      tenant_id: conn.tenant_id,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
