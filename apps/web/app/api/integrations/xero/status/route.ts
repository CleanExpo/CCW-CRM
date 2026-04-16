import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/integrations/xero/status
 * Returns live Xero connection status from Supabase.
 */
export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('xero_connections')
      .select('tenant_id, tenant_name, is_active, last_synced_at, expires_at')
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ connected: false, mode: 'not_configured' });
    }

    // Check if token is expired
    const isExpired = data.expires_at ? new Date(data.expires_at) < new Date() : false;

    return NextResponse.json({
      connected: !isExpired,
      mode: isExpired ? 'not_configured' : 'live',
      tenant_id: data.tenant_id,
      tenant_name: data.tenant_name,
      last_synced_at: data.last_synced_at,
      token_expires_at: data.expires_at,
    });
  } catch (e) {
    return NextResponse.json({ connected: false, mode: 'not_configured', detail: String(e) });
  }
}
