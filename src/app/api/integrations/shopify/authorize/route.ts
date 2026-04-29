import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getShopifyClientId,
  getShopifyRedirectUri,
  getShopifyScopes,
  resolveMyshopifyHost,
} from '@/lib/integrations/shopify';

export async function GET(request: NextRequest) {
  const shopParam = request.nextUrl.searchParams.get('shop')?.trim();
  const shopFromCookie = request.cookies.get('shopify_shop_domain')?.value?.trim();
  const shopFromEnv = process.env.SHOPIFY_SHOP_DOMAIN?.trim();
  const raw = shopParam || shopFromCookie || shopFromEnv || '';
  const { adminHost } = resolveMyshopifyHost(raw);

  if (!adminHost.endsWith('.myshopify.com')) {
    return NextResponse.json(
      {
        detail:
          'A valid Shopify admin hostname is required (e.g. your-store.myshopify.com). If you only have a custom domain, set SHOPIFY_MY_SHOPIFY_DOMAIN to the myshopify hostname from Shopify Admin → Settings → Domains.',
      },
      { status: 400 }
    );
  }

  const clientId = getShopifyClientId();
  if (!clientId) {
    return NextResponse.json(
      { detail: 'Missing SHOPIFY_CLIENT_ID (or SHOPIFY_API_KEY) in environment.' },
      { status: 500 }
    );
  }

  const redirectUri = getShopifyRedirectUri();
  const scopes = getShopifyScopes();
  const state = crypto.randomBytes(16).toString('hex');

  const url = new URL(`https://${adminHost}/admin/oauth/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);

  const res = NextResponse.redirect(url.toString());
  const secure = process.env.NODE_ENV === 'production';
  const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 600 };
  res.cookies.set('shopify_oauth_state', state, cookieOpts);
  res.cookies.set('shopify_oauth_shop', adminHost, cookieOpts);
  return res;
}
