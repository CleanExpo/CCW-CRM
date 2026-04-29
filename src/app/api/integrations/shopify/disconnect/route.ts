import { NextResponse } from 'next/server';

const CLEAR = { path: '/', maxAge: 0 } as const;

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Shopify disconnected.' });
  for (const name of [
    'shopify_connected',
    'shopify_shop_domain',
    'shopify_access_token',
    'shopify_api_key',
    'shopify_api_secret',
    'shopify_webhook_secret',
    'shopify_oauth_state',
    'shopify_oauth_shop',
  ]) {
    response.cookies.set(name, '', CLEAR);
  }
  return response;
}
