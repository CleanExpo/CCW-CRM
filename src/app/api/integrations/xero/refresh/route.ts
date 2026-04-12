import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function POST() {
  try {
    const supabase = createServerClient();

    const { data: connection, error: fetchError } = await supabase
      .from('xero_connections')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({ detail: 'No active Xero connection found.' }, { status: 404 });
    }

    const clientId = process.env.XERO_CLIENT_ID!;
    const clientSecret = process.env.XERO_CLIENT_SECRET!;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token as string,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      // Refresh failed — mark connection inactive so user re-authenticates
      await supabase
        .from('xero_connections')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', connection.id);

      return NextResponse.json(
        { detail: 'Xero refresh token expired. Please re-connect Xero.' },
        { status: 401 }
      );
    }

    const tokens = (await tokenResponse.json()) as XeroTokenResponse;
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase
      .from('xero_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return NextResponse.json({
      success: true,
      expires_at: tokenExpiresAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
