import type { NextRequest } from 'next/server';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import {
  getConfiguredTokenSource as getLegacyTokenSource,
  getXeroClientId,
  getXeroClientSecret,
} from '@/lib/integrations/xero';
import { refreshXeroAccessToken } from '@/lib/integrations/xero-oauth';
import {
  isXeroTokenExpired,
  loadWorkspaceXeroConnection,
  saveWorkspaceXeroConnection,
} from '@/lib/integrations/xero-storage';

export type ResolvedXeroTokens = {
  accessToken: string;
  refreshToken?: string;
  tenantId: string;
  tenantName?: string | null;
  source: 'environment' | 'workspace' | 'cookie';
  expiresAt?: Date | null;
};

async function refreshAndPersistWorkspace(
  workspaceId: string,
  refreshToken: string,
  tenantId: string,
  tenantName: string | null
): Promise<ResolvedXeroTokens | null> {
  if (!getXeroClientId() || !getXeroClientSecret()) return null;
  try {
    const refreshed = await refreshXeroAccessToken(refreshToken);
    await saveWorkspaceXeroConnection({
      workspaceId,
      tenantId,
      tenantName,
      tokens: refreshed,
    });
    return {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? refreshToken,
      tenantId,
      tenantName,
      source: 'workspace',
      expiresAt: refreshed.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves a valid Xero access token (env → workspace DB with refresh → session cookies).
 *
 * IMPORTANT (org-context scoping): the raw-cookie fallback (`xero_access_token` /
 * `xero_refresh_token` / `xero_tenant_id`) is NOT namespaced per workspace — it is a
 * plain browser cookie set by the OAuth callback. It must only ever be used when the
 * caller has no authenticated user context at all (legacy/unauthenticated call sites).
 * Once a `userId` is known, the authenticated user's workspace is the sole source of
 * truth: if that workspace has no stored Xero connection, we must return null rather
 * than falling through to whatever Xero cookies happen to be sitting in the browser,
 * which could belong to a *different* org (e.g. a user who is a member of multiple
 * workspaces, or a shared/kiosk browser that never cleared a previous org's session).
 */
export async function getValidXeroTokens(
  request?: NextRequest,
  userId?: string
): Promise<ResolvedXeroTokens | null> {
  const env = getLegacyTokenSource(request);
  if (env && process.env.XERO_ACCESS_TOKEN?.trim()) {
    return {
      accessToken: env.accessToken,
      refreshToken: env.refreshToken,
      tenantId: env.tenantId,
      source: 'environment',
    };
  }

  if (userId) {
    // Authenticated call: resolve strictly from this user's workspace. Do NOT fall
    // back to unscoped request cookies below — those could belong to another org.
    const workspaceId = await getWorkspaceIdForUser(userId);
    if (!workspaceId) return null;

    const stored = await loadWorkspaceXeroConnection(workspaceId);
    if (!stored) return null;

    if (isXeroTokenExpired(stored.tokenExpiresAt) && stored.refreshToken) {
      const refreshed = await refreshAndPersistWorkspace(
        workspaceId,
        stored.refreshToken,
        stored.tenantId,
        stored.tenantName
      );
      if (refreshed) return refreshed;
    }

    return {
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken ?? undefined,
      tenantId: stored.tenantId,
      tenantName: stored.tenantName,
      source: 'workspace',
      expiresAt: stored.tokenExpiresAt,
    };
  }

  // No authenticated user context provided at all — legacy cookie-based resolution
  // for call sites that predate workspace scoping. Never reached once a userId is
  // supplied, which all current API routes do (see xero/status, xero/refresh,
  // xero/invoice, xero/sync-order).
  if (request) {
    const cookieTokens = getLegacyTokenSource(request);
    if (cookieTokens) {
      return {
        accessToken: cookieTokens.accessToken,
        refreshToken: cookieTokens.refreshToken,
        tenantId: cookieTokens.tenantId,
        source: 'cookie',
      };
    }
  }

  return null;
}
