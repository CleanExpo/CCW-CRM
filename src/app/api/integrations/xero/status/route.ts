import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: connection } = await supabase
      .from('xero_connections')
      .select('tenant_id, tenant_name, is_active, token_expires_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!connection) {
      return NextResponse.json({ connected: false, mode: 'live' });
    }

    const tokenExpiresAt = connection.token_expires_at as string | null;
    const tokenExpired = tokenExpiresAt ? new Date(tokenExpiresAt) < new Date() : true;

    return NextResponse.json({
      connected: connection.is_active && !tokenExpired,
      mode: 'live',
      tenant_id: connection.tenant_id,
      tenant_name: connection.tenant_name,
      token_expires_at: tokenExpiresAt,
      token_expired: tokenExpired,
    });
  } catch {
    return NextResponse.json({ connected: false, mode: 'live' });
  }
}
