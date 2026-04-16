import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * GET /api/integrations/shopify/status
 * Returns live connection status from Supabase.
 */
export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('shopify_connections')
      .select('shop_domain, shop_name, is_active, last_order_sync, last_inventory_sync')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ connected: false, mode: 'not_configured' });
    }

    return NextResponse.json({
      connected: data.is_active,
      mode: data.is_active ? 'live' : 'not_configured',
      shop_domain: data.shop_domain,
      shop_name: data.shop_name,
      last_order_sync: data.last_order_sync,
      last_inventory_sync: data.last_inventory_sync,
    });
  } catch (e) {
    return NextResponse.json({ connected: false, mode: 'not_configured', detail: String(e) });
  }
}
