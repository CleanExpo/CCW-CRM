import type { NextRequest } from 'next/server';
import crypto from 'crypto';

export type ShopifyMode = 'demo' | 'live';

const API_VERSION_FALLBACK = '2025-01';

export function getShopifyMode(): ShopifyMode {
  return process.env.SHOPIFY_MODE === 'live' ? 'live' : 'demo';
}

/** Public app / custom app Client ID (same as “API key” in Shopify admin). */
export function getShopifyClientId(): string {
  return (
    process.env.SHOPIFY_CLIENT_ID?.trim() ||
    process.env.SHOPIFY_API_KEY?.trim() ||
    ''
  );
}

export function getShopifyClientSecret(): string {
  return (
    process.env.SHOPIFY_API_SECRET?.trim() ||
    process.env.SHOPIFY_CLIENT_SECRET?.trim() ||
    ''
  );
}

export function getShopifyRedirectUri(): string {
  const explicit = process.env.SHOPIFY_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_FRONTEND_URL?.trim() || 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/api/integrations/shopify/callback`;
}

export function getShopifyScopes(): string {
  return (
    process.env.SHOPIFY_SCOPES?.trim() ||
    'read_products,write_products,read_orders,read_customers,read_inventory,write_inventory'
  );
}

/**
 * Admin API version must be YYYY-MM. Invalid values fall back (e.g. app name mistaken for version).
 */
export function getShopifyApiVersion(): string {
  const raw = process.env.SHOPIFY_API_VERSION?.trim() || API_VERSION_FALLBACK;
  return /^\d{4}-\d{2}$/.test(raw) ? raw : API_VERSION_FALLBACK;
}

/**
 * Strip protocol/path; return hostname suitable for Admin API host `{host}`.
 * Admin REST/GraphQL must use the *.myshopify.com hostname.
 */
export function normalizeShopifyHostInput(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (!s) return '';
  try {
    if (s.includes('://')) {
      const u = new URL(s);
      s = u.hostname || s;
    } else {
      s = s.split('/')[0] || s;
    }
  } catch {
    s = s.replace(/^https?:\/\//, '').split('/')[0];
  }
  return s.replace(/\.$/, '');
}

export function resolveMyshopifyHost(shopInput: string): { adminHost: string; source: 'input' | 'fallback' } {
  const primary = normalizeShopifyHostInput(shopInput);
  const fallback = normalizeShopifyHostInput(process.env.SHOPIFY_MY_SHOPIFY_DOMAIN?.trim() || '');
  if (primary.endsWith('.myshopify.com')) return { adminHost: primary, source: 'input' };
  if (fallback.endsWith('.myshopify.com')) return { adminHost: fallback, source: 'fallback' };
  return { adminHost: primary, source: 'input' };
}

/**
 * Namespaces a Shopify credential cookie name to a workspace, so one workspace's stored
 * shop/token cannot be read back for a different, authenticated workspace on a shared
 * browser/session. Callers that genuinely have no workspace context (none of the current
 * API routes — see below) get the legacy, unscoped name.
 */
export function shopifyCookieName(base: string, workspaceId?: string): string {
  return workspaceId ? `${base}__${workspaceId}` : base;
}

/**
 * Resolves the configured Shopify shop/token for this request.
 *
 * IMPORTANT (org-context scoping): Shopify has no workspace-scoped connection table
 * (unlike WorkspaceXeroConnection) — the browser cookie set by the OAuth callback /
 * configure route *is* the only storage. Once a `workspaceId` is known, credentials must
 * be read from that workspace's namespaced cookies (`shopify_shop_domain__<workspaceId>`,
 * `shopify_access_token__<workspaceId>`) only. We must NOT fall back to the legacy,
 * unnamespaced cookies in that case — those could belong to a *different* workspace
 * (e.g. a user who is a member of multiple workspaces, or a shared/kiosk browser that
 * never cleared a previous org's session), mirroring the Xero cross-tenant token leak
 * fixed in getValidXeroTokens(). The global `SHOPIFY_SHOP_DOMAIN` / `SHOPIFY_ACCESS_TOKEN`
 * env vars remain a valid fallback in both cases — they are operator-configured
 * single-tenant deployment config, not per-user browser state.
 */
export function getConfiguredShopifyFromRequest(
  request: NextRequest,
  workspaceId?: string
): {
  shopDomain: string;
  accessToken: string;
  adminHost: string;
} | null {
  const shopCookieName = shopifyCookieName('shopify_shop_domain', workspaceId);
  const tokenCookieName = shopifyCookieName('shopify_access_token', workspaceId);

  const cookieShop =
    request.cookies.get(shopCookieName)?.value?.trim() ||
    process.env.SHOPIFY_SHOP_DOMAIN?.trim() ||
    '';
  const token =
    request.cookies.get(tokenCookieName)?.value?.trim() ||
    process.env.SHOPIFY_ACCESS_TOKEN?.trim() ||
    '';
  const { adminHost } = resolveMyshopifyHost(cookieShop);
  if (!adminHost.endsWith('.myshopify.com') || !token) return null;
  return { shopDomain: adminHost, accessToken: token, adminHost };
}

export function adminApiUrl(adminHost: string, pathWithLeadingSlash: string): string {
  const v = getShopifyApiVersion();
  const p = pathWithLeadingSlash.startsWith('/') ? pathWithLeadingSlash : `/${pathWithLeadingSlash}`;
  return `https://${adminHost}/admin/api/${v}${p}`;
}

export async function shopifyAdminJson<T>(
  adminHost: string,
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(adminApiUrl(adminHost, path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Shopify-Access-Token': accessToken,
      ...(init?.headers as Record<string, string>),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function exchangeShopifyOAuthCode(
  adminHost: string,
  code: string
): Promise<{ access_token: string; scope?: string }> {
  const clientId = getShopifyClientId();
  const clientSecret = getShopifyClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('Missing SHOPIFY_CLIENT_ID or SHOPIFY_API_SECRET');
  }
  const res = await fetch(`https://${adminHost}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; scope?: string; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || `Token exchange failed (${res.status})`);
  }
  return { access_token: data.access_token, scope: data.scope };
}

export function verifyShopifyOAuthHmac(query: URLSearchParams, clientSecret: string): boolean {
  const hmac = query.get('hmac');
  if (!hmac || !clientSecret) return false;
  const pairs = [...query.entries()]
    .filter(([k]) => k !== 'hmac' && k !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const digest = crypto.createHmac('sha256', clientSecret).update(pairs, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(digest, 'hex'));
  } catch {
    return false;
  }
}

export async function fetchShopifyShop(
  adminHost: string,
  accessToken: string
): Promise<{ name: string; domain: string; email?: string } | null> {
  const { ok, data } = await shopifyAdminJson<{ shop?: { name: string; domain: string; email?: string } }>(
    adminHost,
    accessToken,
    '/shop.json'
  );
  if (!ok || !data.shop) return null;
  return data.shop;
}
