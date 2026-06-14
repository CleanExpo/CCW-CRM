/**
 * Toby onboarding / integration hardening: Shopify credential routes require auth.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceIdForUser: vi.fn(),
}));

vi.mock('@/lib/integrations/shopify', () => ({
  getShopifyMode: vi.fn(() => 'demo'),
  resolveMyshopifyHost: vi.fn((s: string) => ({
    adminHost: s.includes('.') ? s : `${s}.myshopify.com`,
    source: 'input' as const,
  })),
  getConfiguredShopifyFromRequest: vi.fn(() => null),
  fetchShopifyShop: vi.fn(),
  getShopifyApiVersion: vi.fn(() => '2025-01'),
  getShopifyClientId: vi.fn(() => 'client-id'),
  getShopifyRedirectUri: vi.fn(() => 'http://localhost/callback'),
  getShopifyScopes: vi.fn(() => 'read_products'),
  getShopifyClientSecret: vi.fn(() => 'secret'),
  verifyShopifyOAuthHmac: vi.fn(() => true),
  exchangeShopifyOAuthCode: vi.fn().mockResolvedValue({ access_token: 'tok' }),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { POST as configurePost } from '@/app/api/integrations/shopify/configure/route';
import { POST as connectPost } from '@/app/api/integrations/shopify/connect/route';
import { POST as disconnectPost } from '@/app/api/integrations/shopify/disconnect/route';
import { GET as statusGet } from '@/app/api/integrations/shopify/status/route';
import { GET as authorizeGet } from '@/app/api/integrations/shopify/authorize/route';
import { GET as callbackGet } from '@/app/api/integrations/shopify/callback/route';
import { SHOPIFY_OAUTH_STATE_COOKIE } from '@/lib/integrations/shopify-oauth';

const AUTH = { userId: 'user-1', role: 'owner' as const, isAdmin: true };

function setAuthenticated(workspaceId: string | null = 'ws-1') {
  vi.mocked(requireAuthScope).mockResolvedValue(AUTH);
  vi.mocked(getWorkspaceIdForUser).mockResolvedValue(workspaceId);
}

describe('Shopify integration routes require authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('configure returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    const res = await configurePost(
      new Request('http://localhost/api/integrations/shopify/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_domain: 'x.myshopify.com', access_token: 'tok' }),
      }) as never
    );
    expect(res.status).toBe(401);
  });

  it('configure returns 403 when user has no workspace', async () => {
    setAuthenticated(null);
    const res = await configurePost(
      new Request('http://localhost/api/integrations/shopify/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_domain: 'x.myshopify.com', access_token: 'tok' }),
      }) as never
    );
    expect(res.status).toBe(403);
  });

  it('connect returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    const res = await connectPost(
      new Request('http://localhost/api/integrations/shopify/connect', { method: 'POST' }) as never
    );
    expect(res.status).toBe(401);
  });

  it('disconnect returns 403 without a workspace', async () => {
    setAuthenticated(null);
    const res = await disconnectPost(
      new Request('http://localhost/api/integrations/shopify/disconnect', { method: 'POST' }) as never
    );
    expect(res.status).toBe(403);
  });

  it('status returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    const res = await statusGet(new Request('http://localhost/api/integrations/shopify/status') as never);
    expect(res.status).toBe(401);
  });

  it('authorize returns 401 when unauthenticated', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    const res = await authorizeGet(
      new Request('http://localhost/api/integrations/shopify/authorize?shop=store.myshopify.com') as never
    );
    expect(res.status).toBe(401);
  });

  it('callback redirects with error when session is missing', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    vi.mocked(getWorkspaceIdForUser).mockResolvedValue('ws-1');
    const res = await callbackGet(
      new NextRequest(
        `http://localhost/api/integrations/shopify/callback?code=abc&shop=store.myshopify.com&state=state1`,
        {
          headers: { cookie: `${SHOPIFY_OAUTH_STATE_COOKIE}=state1` },
        }
      )
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/shopify_error=/);
  });
});
