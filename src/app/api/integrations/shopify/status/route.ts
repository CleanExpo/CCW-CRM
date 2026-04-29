import { NextRequest, NextResponse } from 'next/server';

function getMode() {
  return process.env.SHOPIFY_MODE === 'demo' ? 'demo' : 'live';
}

export async function GET(request: NextRequest) {
  const mode = getMode();
  const cookieDomain = request.cookies.get('shopify_shop_domain')?.value?.trim();
  const cookieToken = request.cookies.get('shopify_access_token')?.value?.trim();
  const connectedCookie = request.cookies.get('shopify_connected')?.value === '1';

  const shopDomain = cookieDomain || process.env.SHOPIFY_SHOP_DOMAIN?.trim();
  const accessToken = cookieToken || process.env.SHOPIFY_ACCESS_TOKEN?.trim();
  const hasCreds = Boolean(shopDomain && accessToken);

  if (!hasCreds) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      message: 'Missing Shopify credentials. Save your shop domain and access token.',
    });
  }

  const connected = connectedCookie || mode === 'demo';
  return NextResponse.json({
    connected,
    mode,
    shop_domain: shopDomain,
    shop_name: shopDomain,
    message: connected
      ? mode === 'demo'
        ? 'Connected in demo mode.'
        : 'Connected to Shopify.'
      : 'Credentials saved. Click Connect to activate.',
  });
}
