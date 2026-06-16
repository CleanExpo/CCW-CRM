import { describe, it, expect } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  SHOPIFY_OAUTH_SHOP_COOKIE,
  SHOPIFY_OAUTH_STATE_COOKIE,
  clearShopifyOAuthStateCookies,
  verifyShopifyOAuthShop,
  verifyShopifyOAuthState,
} from '@/lib/integrations/shopify-oauth';

function requestWithCookies(cookies: Record<string, string>, url = 'http://localhost/callback') {
  return new NextRequest(url, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('; '),
    },
  });
}

describe('shopify-oauth helpers', () => {
  it('verifyShopifyOAuthState accepts matching state cookie', () => {
    const req = requestWithCookies({ [SHOPIFY_OAUTH_STATE_COOKIE]: 'abc123' });
    expect(verifyShopifyOAuthState(req, 'abc123')).toBe(true);
  });

  it('verifyShopifyOAuthState rejects mismatched state', () => {
    const req = requestWithCookies({ [SHOPIFY_OAUTH_STATE_COOKIE]: 'abc123' });
    expect(verifyShopifyOAuthState(req, 'wrong')).toBe(false);
  });

  it('verifyShopifyOAuthShop rejects shop mismatch when cookie is set', () => {
    const req = requestWithCookies({ [SHOPIFY_OAUTH_SHOP_COOKIE]: 'a.myshopify.com' });
    expect(verifyShopifyOAuthShop(req, 'b.myshopify.com')).toBe(false);
  });

  it('clearShopifyOAuthStateCookies clears oauth cookies', () => {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SHOPIFY_OAUTH_STATE_COOKIE, 'x');
    res.cookies.set(SHOPIFY_OAUTH_SHOP_COOKIE, 'shop.myshopify.com');
    clearShopifyOAuthStateCookies(res);
    expect(res.cookies.get(SHOPIFY_OAUTH_STATE_COOKIE)?.value).toBe('');
  });
});
