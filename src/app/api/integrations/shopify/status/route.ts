import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import {
  fetchShopifyShop,
  getConfiguredShopifyFromRequest,
  getShopifyApiVersion,
  getShopifyMode,
  resolveMyshopifyHost,
  shopifyCookieName,
} from '@/lib/integrations/shopify';

export async function GET(request: NextRequest) {
  const scope = await requireAuthScope(request);
  if (!scope) {
    return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  }

  const workspaceId = await getWorkspaceIdForUser(scope.userId);
  if (!workspaceId) {
    return NextResponse.json({ detail: 'No workspace found for this user' }, { status: 403 });
  }

  const configuredMode = getShopifyMode();
  const connectedCookie =
    request.cookies.get(shopifyCookieName('shopify_connected', workspaceId))?.value === '1';

  const rawShop =
    request.cookies.get(shopifyCookieName('shopify_shop_domain', workspaceId))?.value?.trim() ||
    process.env.SHOPIFY_SHOP_DOMAIN?.trim() ||
    '';
  const cookieToken =
    request.cookies.get(shopifyCookieName('shopify_access_token', workspaceId))?.value?.trim() ||
    process.env.SHOPIFY_ACCESS_TOKEN?.trim() ||
    '';

  const { adminHost, source } = resolveMyshopifyHost(rawShop);
  const hasMyshopify = adminHost.endsWith('.myshopify.com');
  const hasToken = Boolean(cookieToken);

  if (!hasMyshopify || !hasToken) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      shop_domain: rawShop || undefined,
      message:
        'Missing Shopify admin hostname (*.myshopify.com) or access token. Use OAuth or paste an Admin API token from your custom app.',
    });
  }

  const creds = getConfiguredShopifyFromRequest(request, workspaceId);
  if (!creds) {
    return NextResponse.json({
      connected: false,
      mode: 'not_configured',
      message: 'Could not resolve Shopify credentials.',
    });
  }

  const shopInfo = await fetchShopifyShop(creds.adminHost, creds.accessToken);
  if (!shopInfo) {
    return NextResponse.json({
      connected: false,
      mode: configuredMode,
      shop_domain: creds.shopDomain,
      api_version: getShopifyApiVersion(),
      message:
        configuredMode === 'live'
          ? 'Saved token is invalid or expired. Re-authorize with Shopify or update SHOPIFY_ACCESS_TOKEN.'
          : 'Could not reach Shopify with the current token.',
    });
  }

  const connected = connectedCookie || Boolean(shopInfo);
  return NextResponse.json({
    connected,
    mode: 'live',
    shop_domain: creds.shopDomain,
    shop_name: shopInfo.name,
    storefront_domain: shopInfo.domain,
    api_version: getShopifyApiVersion(),
    myshopify_source: source,
    message: connected
      ? `Connected to ${shopInfo.name}.`
      : 'Verified with Shopify. Click Connect to mark the integration active.',
  });
}
