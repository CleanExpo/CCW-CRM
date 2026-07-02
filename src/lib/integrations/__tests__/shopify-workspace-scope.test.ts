/**
 * UNI-2106: Shopify credentials must be scoped to the authenticated user's workspace/org,
 * mirroring the Xero cross-tenant token leak fixed for getValidXeroTokens() (PR #229).
 *
 * Bug: getConfiguredShopifyFromRequest() reads `shopify_shop_domain` / `shopify_access_token`
 * straight off plain, non-namespaced request cookies (or global env vars) with no workspace
 * check at all. Every Shopify route (status, connect, sync-inventory, sync-product,
 * import-order(s)) calls this helper directly. On a shared browser/session (agency staff
 * managing multiple client workspaces, a user who is a member of multiple workspaces, or a
 * kiosk machine that never cleared a previous org's session), Org B's authenticated request
 * silently picks up Org A's Shopify shop domain + Admin API access token — an org-context
 * leak across workspaces. This is worse than the Xero case because Shopify has no
 * workspace-scoped connection storage at all (unlike WorkspaceXeroConnection): the cookie
 * *is* the only storage, and it is never namespaced per workspace.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { getConfiguredShopifyFromRequest } from '../shopify';

function requestWithOrgACookies(url = 'http://localhost/api/integrations/shopify/status'): NextRequest {
  // Simulates a browser that still carries Org A's Shopify session cookies (set by an
  // earlier OAuth callback/configure call) while the *currently authenticated* user is
  // now a member of Org B.
  const req = new NextRequest(url);
  req.cookies.set('shopify_shop_domain', 'org-a-shop.myshopify.com');
  req.cookies.set('shopify_access_token', 'ORG-A-ACCESS-TOKEN');
  req.cookies.set('shopify_connected', '1');
  return req;
}

describe('getConfiguredShopifyFromRequest workspace scoping', () => {
  it('must NOT hand back Org A cookie credentials to a request authenticated for Org B', () => {
    const req = requestWithOrgACookies();

    // Org B has never connected its own Shopify store. The resolver must not read/act on
    // Org A's leftover credentials just because they happen to be present on the request.
    const credsForOrgB = getConfiguredShopifyFromRequest(req, 'workspace-org-b');

    expect(credsForOrgB).toBeNull();
  });

  it('returns the matching workspace credentials when the cookie was namespaced for that workspace', () => {
    const req = new NextRequest('http://localhost/api/integrations/shopify/status');
    req.cookies.set('shopify_shop_domain__workspace-org-b', 'org-b-shop.myshopify.com');
    req.cookies.set('shopify_access_token__workspace-org-b', 'ORG-B-ACCESS-TOKEN');

    const creds = getConfiguredShopifyFromRequest(req, 'workspace-org-b');

    expect(creds?.adminHost).toBe('org-b-shop.myshopify.com');
    expect(creds?.accessToken).toBe('ORG-B-ACCESS-TOKEN');
  });
});
