import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: connection } = await supabase
      .from('shopify_connections')
      .select(
        'shop_domain, shop_name, shop_email, currency, is_active, last_order_sync, last_inventory_sync'
      )
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!connection) {
      return NextResponse.json({ connected: false, mode: 'live' });
    }

    return NextResponse.json({
      connected: connection.is_active,
      mode: 'live',
      shop_domain: connection.shop_domain,
      shop_name: connection.shop_name,
      shop_email: connection.shop_email,
      currency: connection.currency,
      last_order_sync: connection.last_order_sync,
      last_inventory_sync: connection.last_inventory_sync,
    });
  } catch {
    return NextResponse.json({ connected: false, mode: 'live' });
  }
}
