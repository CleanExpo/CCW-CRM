import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    shop_domain?: string;
    access_token?: string;
    api_key?: string;
    api_secret?: string;
    webhook_secret?: string;
  };

  const shopDomain = String(body.shop_domain ?? '').trim();
  const accessToken = String(body.access_token ?? '').trim();
  if (!shopDomain || !accessToken) {
    return NextResponse.json({ detail: 'shop_domain and access_token are required' }, { status: 400 });
  }

  const res = NextResponse.json({
    connected: false,
    mode: process.env.SHOPIFY_MODE === 'demo' ? 'demo' : 'live',
    shop_domain: shopDomain,
    message: 'Credentials saved. Click Connect to activate.',
  });
  const secure = process.env.NODE_ENV === 'production';
  const common = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 60 * 60 * 24 * 30 };
  res.cookies.set('shopify_shop_domain', shopDomain, common);
  res.cookies.set('shopify_access_token', accessToken, common);
  if (body.api_key) res.cookies.set('shopify_api_key', body.api_key, common);
  if (body.api_secret) res.cookies.set('shopify_api_secret', body.api_secret, common);
  if (body.webhook_secret) res.cookies.set('shopify_webhook_secret', body.webhook_secret, common);
  res.cookies.set('shopify_connected', '0', common);
  return res;
}

