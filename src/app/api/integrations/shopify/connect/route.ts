import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  currency: string;
  myshopify_domain: string;
}

export async function POST() {
  try {
    const supabase = createServerClient();

    // Get the most recently updated inactive (or any) connection to test
    const { data: connection, error: fetchError } = await supabase
      .from('shopify_connections')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json(
        { detail: 'No Shopify credentials found. Call /configure first.' },
        { status: 404 }
      );
    }

    // Verify credentials against Shopify Admin API
    const shopResponse = await fetch(
      `https://${connection.shop_domain}/admin/api/2026-01/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': connection.access_token as string,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!shopResponse.ok) {
      const text = await shopResponse.text();
      return NextResponse.json(
        { detail: `Shopify rejected credentials: ${shopResponse.status} — ${text}` },
        { status: 422 }
      );
    }

    const { shop } = (await shopResponse.json()) as { shop: ShopifyShop };

    // Mark connection as active and store shop metadata
    const { error: updateError } = await supabase
      .from('shopify_connections')
      .update({
        is_active: true,
        shop_name: shop.name,
        shop_email: shop.email,
        currency: shop.currency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      connected: true,
      shop_domain: connection.shop_domain,
      shop_name: shop.name,
      shop_email: shop.email,
      currency: shop.currency,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
