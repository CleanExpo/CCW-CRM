/**
 * UNI-2106: Xero tokens must be scoped to the authenticated user's workspace/org.
 *
 * Bug: getValidXeroTokens() falls back to reading `xero_access_token` /
 * `xero_refresh_token` / `xero_tenant_id` straight off the request's cookies
 * whenever the workspace-scoped DB lookup misses (e.g. a brand-new workspace
 * that hasn't connected Xero yet, or a transient DB read issue). Those cookies
 * are NOT namespaced per workspace — they are plain browser cookies set by the
 * OAuth callback. On a shared browser/session (agency staff, kiosk machine,
 * user who is a member of multiple workspaces) this lets Org B's authenticated
 * request silently pick up Org A's Xero access token/tenant, i.e. an org-context
 * leak across workspaces.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceIdForUser: vi.fn(),
}));

vi.mock('@/lib/integrations/xero', () => ({
  getConfiguredTokenSource: vi.fn(),
  getXeroClientId: vi.fn(() => ''),
  getXeroClientSecret: vi.fn(() => ''),
}));

vi.mock('@/lib/integrations/xero-oauth', () => ({
  refreshXeroAccessToken: vi.fn(),
}));

vi.mock('@/lib/integrations/xero-storage', () => ({
  isXeroTokenExpired: vi.fn(() => false),
  loadWorkspaceXeroConnection: vi.fn(),
  saveWorkspaceXeroConnection: vi.fn(),
}));

import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { getConfiguredTokenSource } from '@/lib/integrations/xero';
import { loadWorkspaceXeroConnection } from '@/lib/integrations/xero-storage';
import { getValidXeroTokens } from '../xero-tokens';

function requestWithLeftoverCookiesFromOrgA(): NextRequest {
  // Simulates a browser that still carries Org A's Xero session cookies
  // (e.g. set by an earlier OAuth callback) while the *currently
  // authenticated* user now belongs to Org B.
  const req = new NextRequest('http://localhost/api/integrations/xero/status');
  req.cookies.set('xero_access_token', 'ORG-A-ACCESS-TOKEN');
  req.cookies.set('xero_refresh_token', 'ORG-A-REFRESH-TOKEN');
  req.cookies.set('xero_tenant_id', 'ORG-A-TENANT-ID');
  return req;
}

describe('getValidXeroTokens org-context scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No global env token configured — getConfiguredTokenSource only returns
    // cookie-derived data (mirrors the "not configured via env" prod case).
    vi.mocked(getConfiguredTokenSource).mockImplementation((request?: NextRequest) => {
      if (!request) return null;
      const accessToken = request.cookies.get('xero_access_token')?.value;
      const refreshToken = request.cookies.get('xero_refresh_token')?.value;
      const tenantId = request.cookies.get('xero_tenant_id')?.value;
      if (!accessToken || !tenantId) return null;
      return { accessToken, refreshToken, tenantId };
    });
  });

  it('does NOT leak Org A cookie tokens into Org B when Org B has no stored Xero connection', async () => {
    vi.mocked(getWorkspaceIdForUser).mockResolvedValue('workspace-org-b');
    vi.mocked(loadWorkspaceXeroConnection).mockResolvedValue(null); // Org B never connected Xero

    const req = requestWithLeftoverCookiesFromOrgA();
    const tokens = await getValidXeroTokens(req, 'user-in-org-b');

    // Org B has no Xero connection of its own — the resolver must not hand
    // back Org A's leftover cookie-based tenant/token.
    expect(tokens).toBeNull();
  });

  it('uses the workspace-scoped connection for the authenticated org, ignoring stale cookies', async () => {
    vi.mocked(getWorkspaceIdForUser).mockResolvedValue('workspace-org-b');
    vi.mocked(loadWorkspaceXeroConnection).mockResolvedValue({
      workspaceId: 'workspace-org-b',
      tenantId: 'ORG-B-TENANT-ID',
      tenantName: 'Org B Pty Ltd',
      accessToken: 'ORG-B-ACCESS-TOKEN',
      refreshToken: 'ORG-B-REFRESH-TOKEN',
      tokenExpiresAt: null,
    });

    const req = requestWithLeftoverCookiesFromOrgA();
    const tokens = await getValidXeroTokens(req, 'user-in-org-b');

    expect(tokens?.tenantId).toBe('ORG-B-TENANT-ID');
    expect(tokens?.accessToken).toBe('ORG-B-ACCESS-TOKEN');
    expect(tokens?.source).toBe('workspace');
  });
});
