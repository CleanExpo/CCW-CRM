import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { shop_domain?: string; access_token?: string };
    const { shop_domain, access_token } = body;

    if (!shop_domain || !access_token) {
      return NextResponse.json(
        { detail: 'shop_domain and access_token are required' },
        { status: 400 }
      );
    }

    // Normalise domain — strip protocol and trailing slash
    const normalisedDomain = shop_domain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    if (!normalisedDomain.includes('.myshopify.com')) {
      return NextResponse.json(
        { detail: 'shop_domain must be a valid myshopify.com domain' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { error } = await supabase.from('shopify_connections').upsert(
      {
        shop_domain: normalisedDomain,
        access_token,
        is_active: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_domain' }
    );

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      shop_domain: normalisedDomain,
      message: 'Shopify credentials saved. Run /api/integrations/shopify/connect to verify.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
