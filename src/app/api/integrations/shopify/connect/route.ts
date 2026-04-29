import { NextRequest, NextResponse } from 'next/server';
import { fetchShopifyShop, getConfiguredShopifyFromRequest } from '@/lib/integrations/shopify';

export async function POST(request: NextRequest) {
  const creds = getConfiguredShopifyFromRequest(request);
  if (!creds) {
    return NextResponse.json({ detail: 'Shopify credentials not configured.' }, { status: 400 });
  }

  const shop = await fetchShopifyShop(creds.adminHost, creds.accessToken);
  if (!shop) {
    return NextResponse.json(
      { detail: 'Could not verify Shopify token. Check shop domain and Admin API access token.' },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    success: true,
    shop_domain: creds.shopDomain,
    shop_name: shop.name,
    message: `Connected to ${shop.name}.`,
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
