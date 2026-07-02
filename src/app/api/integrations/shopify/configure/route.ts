import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getShopifyMode, resolveMyshopifyHost, shopifyCookieName } from '@/lib/integrations/shopify';

export async function POST(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    shop_domain?: string;
    access_token?: string;
    api_key?: string;
    api_secret?: string;
    webhook_secret?: string;
  };

  const shopInput = String(body.shop_domain ?? '').trim();
  const accessToken = String(body.access_token ?? '').trim();
  if (!shopInput || !accessToken) {
    return NextResponse.json({ detail: 'shop_domain and access_token are required' }, { status: 400 });
  }

  let shopDomain = shopInput;
  if (!shopDomain.includes('.')) {
    shopDomain = `${shopDomain}.myshopify.com`;
  }
  const { adminHost } = resolveMyshopifyHost(shopDomain);
  if (!adminHost.endsWith('.myshopify.com')) {
    return NextResponse.json(
      {
        detail:
          'Shop domain must be your *.myshopify.com hostname (Settings → Domains in Shopify). Custom storefront URLs alone cannot be used for the Admin API.',
      },
      { status: 400 }
    );
  }

  const res = NextResponse.json({
    connected: false,
    mode: getShopifyMode(),
    shop_domain: adminHost,
    message: 'Credentials saved. Click Connect to verify and activate.',
  });
  const secure = process.env.NODE_ENV === 'production';
  const common = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 60 * 60 * 24 * 30 };
  res.cookies.set(shopifyCookieName('shopify_shop_domain', workspaceId), adminHost, common);
  res.cookies.set(shopifyCookieName('shopify_access_token', workspaceId), accessToken, common);
  if (body.api_key) res.cookies.set(shopifyCookieName('shopify_api_key', workspaceId), body.api_key, common);
  if (body.api_secret)
    res.cookies.set(shopifyCookieName('shopify_api_secret', workspaceId), body.api_secret, common);
  if (body.webhook_secret)
    res.cookies.set(shopifyCookieName('shopify_webhook_secret', workspaceId), body.webhook_secret, common);
  res.cookies.set(shopifyCookieName('shopify_connected', workspaceId), '0', common);
  return res;
}
