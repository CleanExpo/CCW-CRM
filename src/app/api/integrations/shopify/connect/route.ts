import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const shopDomain =
    request.cookies.get('shopify_shop_domain')?.value?.trim() ||
    process.env.SHOPIFY_SHOP_DOMAIN?.trim();
  const accessToken =
    request.cookies.get('shopify_access_token')?.value?.trim() ||
    process.env.SHOPIFY_ACCESS_TOKEN?.trim();

  if (!shopDomain || !accessToken) {
    return NextResponse.json({ detail: 'Shopify credentials not configured.' }, { status: 400 });
  }

  const mode = process.env.SHOPIFY_MODE === 'demo' ? 'demo' : 'live';
  const response = NextResponse.json({
    success: true,
    mode,
    shop_domain: shopDomain,
    shop_name: shopDomain,
    message: mode === 'demo' ? 'Demo mode active.' : 'Connected to Shopify.',
  });
  response.cookies.set('shopify_connected', '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

