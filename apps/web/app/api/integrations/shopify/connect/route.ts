import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/integrations/shopify/connect
 * Verify saved credentials against Shopify API and mark connection active.
 */
export async function POST() {
  try {
    const supabase = createServerClient();

    // Get saved credentials
    const { data: conn, error: fetchError } = await supabase
      .from('shopify_connections')
      .select('*')
      .eq('is_active', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Also check if already active
    const { data: activeConn } = await supabase
      .from('shopify_connections')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    const connection = conn ?? activeConn;

    if (fetchError) throw fetchError;
    if (!connection) {
      return NextResponse.json(
        { detail: 'No credentials found. Please configure Shopify first.' },
        { status: 400 }
      );
    }

    // Verify against Shopify Admin API
    const shopifyRes = await fetch(
      `https://${connection.shop_domain}/admin/api/2024-01/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': connection.access_token,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!shopifyRes.ok) {
      const err = await shopifyRes.text();
      return NextResponse.json(
        { detail: `Shopify rejected credentials: ${shopifyRes.status} — ${err}` },
        { status: 422 }
      );
    }

    const shopData = (await shopifyRes.json()) as {
      shop: { name: string; email: string; currency: string };
    };
    const { name, email, currency } = shopData.shop;

    // Mark active and save shop metadata
    const { error: updateError } = await supabase
      .from('shopify_connections')
      .update({
        is_active: true,
        shop_name: name,
        shop_email: email,
        currency: currency ?? 'AUD',
        updated_at: new Date().toISOString(),
      })
      .eq('shop_domain', connection.shop_domain);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      mode: 'live',
      shop_domain: connection.shop_domain,
      shop_name: name,
      message: `Connected to ${name}`,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
