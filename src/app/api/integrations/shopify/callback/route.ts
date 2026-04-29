import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeShopifyOAuthCode,
  getShopifyClientSecret,
  verifyShopifyOAuthHmac,
} from '@/lib/integrations/shopify';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const params = url.searchParams;
  const code = params.get('code');
  const shop = params.get('shop')?.trim();
  const state = params.get('state');
  const cookieState = request.cookies.get('shopify_oauth_state')?.value;
  const cookieShop = request.cookies.get('shopify_oauth_shop')?.value?.trim();

  const base = process.env.NEXT_PUBLIC_FRONTEND_URL?.trim() || 'http://localhost:3000';
  const settingsUrl = `${base.replace(/\/$/, '')}/settings/integrations`;

  const fail = (msg: string) =>
    NextResponse.redirect(`${settingsUrl}?shopify_error=${encodeURIComponent(msg)}`);

  if (!code || !shop) {
    return fail('Missing OAuth code or shop.');
  }
  if (!state || !cookieState || state !== cookieState) {
    return fail('Invalid OAuth state. Retry authorization.');
  }
  if (!shop.endsWith('.myshopify.com')) {
    return fail('Invalid shop hostname.');
  }
  if (cookieShop && cookieShop !== shop) {
    return fail('Shop mismatch during OAuth. Retry authorization.');
  }

  const secret = getShopifyClientSecret();
  if (!secret || !verifyShopifyOAuthHmac(params, secret)) {
    return fail('OAuth HMAC verification failed.');
  }

  try {
    const { access_token } = await exchangeShopifyOAuthCode(shop, code);
    const res = NextResponse.redirect(`${settingsUrl}?shopify_success=1`);
    const secure = process.env.NODE_ENV === 'production';
    const common = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 60 * 60 * 24 * 30 };
    res.cookies.set('shopify_shop_domain', shop, common);
    res.cookies.set('shopify_access_token', access_token, common);
    res.cookies.set('shopify_connected', '1', common);
    res.cookies.set('shopify_oauth_state', '', { path: '/', maxAge: 0 });
    res.cookies.set('shopify_oauth_shop', '', { path: '/', maxAge: 0 });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth token exchange failed.';
    return fail(msg);
  }
}
