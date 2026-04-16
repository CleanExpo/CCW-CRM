import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

/**
 * POST /api/integrations/shopify/configure
 * Save Shopify credentials to Supabase. Does not test the connection.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shop_domain, access_token } = body as {
      shop_domain: string;
      access_token: string;
    };

    if (!shop_domain || !access_token) {
      return NextResponse.json(
        { detail: 'shop_domain and access_token are required' },
        { status: 400 }
      );
    }

    // Normalise domain
    const domain = shop_domain.includes('.myshopify.com')
      ? shop_domain.trim()
      : `${shop_domain.trim()}.myshopify.com`;

    const supabase = createServerClient();
    const { error } = await supabase.from('shopify_connections').upsert(
      {
        shop_domain: domain,
        access_token: access_token.trim(),
        is_active: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_domain' }
    );

    if (error) throw error;

    return NextResponse.json({
      connected: false,
      mode: 'live',
      shop_domain: domain,
      message: 'Credentials saved. Click Connect to activate.',
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
