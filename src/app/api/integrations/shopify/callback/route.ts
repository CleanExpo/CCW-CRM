import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import {
  exchangeShopifyOAuthCode,
  getShopifyClientSecret,
  shopifyCookieName,
  verifyShopifyOAuthHmac,
} from '@/lib/integrations/shopify';
import {
  clearShopifyOAuthStateCookies,
  verifyShopifyOAuthShop,
  verifyShopifyOAuthState,
} from '@/lib/integrations/shopify-oauth';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const params = url.searchParams;
  const code = params.get('code');
  const shop = params.get('shop')?.trim();
  const state = params.get('state');
  const cookieState = request.cookies.get('shopify_oauth_state')?.value;

  const base = process.env.NEXT_PUBLIC_FRONTEND_URL?.trim() || 'http://localhost:3000';
  const settingsUrl = `${base.replace(/\/$/, '')}/dashboard/settings/integrations`;

  const fail = (msg: string) =>
    NextResponse.redirect(`${settingsUrl}?shopify_error=${encodeURIComponent(msg)}`);

  if (!code || !shop) {
    return fail('Missing OAuth code or shop.');
  }
  if (!verifyShopifyOAuthState(request, state)) {
    return fail('Invalid OAuth state. Retry authorization.');
  }
  if (!shop.endsWith('.myshopify.com')) {
    return fail('Invalid shop hostname.');
  }
  if (!verifyShopifyOAuthShop(request, shop)) {
    return fail('Shop mismatch during OAuth. Retry authorization.');
  }

  const scope = await requireAuthScope(request);
  if (!scope) {
    return fail('You must be logged in to complete Shopify connection.');
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return fail('No workspace found for this user.');
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
    res.cookies.set(shopifyCookieName('shopify_shop_domain', workspaceId), shop, common);
    res.cookies.set(shopifyCookieName('shopify_access_token', workspaceId), access_token, common);
    res.cookies.set(shopifyCookieName('shopify_connected', workspaceId), '1', common);
    clearShopifyOAuthStateCookies(res);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth token exchange failed.';
    return fail(msg);
  }
}
