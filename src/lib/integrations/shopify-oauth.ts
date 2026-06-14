import type { NextRequest, NextResponse } from 'next/server';

export const SHOPIFY_OAUTH_STATE_COOKIE = 'shopify_oauth_state';
export const SHOPIFY_OAUTH_SHOP_COOKIE = 'shopify_oauth_shop';

export function verifyShopifyOAuthState(request: NextRequest, state: string | null): boolean {
  if (!state?.trim()) return false;
  const expected = request.cookies.get(SHOPIFY_OAUTH_STATE_COOKIE)?.value?.trim();
  return Boolean(expected && expected === state.trim());
}

export function verifyShopifyOAuthShop(
  request: NextRequest,
  shop: string | null | undefined
): boolean {
  if (!shop?.trim()) return false;
  const cookieShop = request.cookies.get(SHOPIFY_OAUTH_SHOP_COOKIE)?.value?.trim();
  if (!cookieShop) return true;
  return cookieShop === shop.trim();
}

export function clearShopifyOAuthStateCookies(response: NextResponse): void {
  const clear = { path: '/', maxAge: 0 };
  response.cookies.set(SHOPIFY_OAUTH_STATE_COOKIE, '', clear);
  response.cookies.set(SHOPIFY_OAUTH_SHOP_COOKIE, '', clear);
}
