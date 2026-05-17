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
    const workspaceId = await getWorkspaceIdForUser(userId);
    if (workspaceId) {
      const stored = await loadWorkspaceXeroConnection(workspaceId);
      if (stored) {
        if (
          isXeroTokenExpired(stored.tokenExpiresAt) &&
          stored.refreshToken
        ) {
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
    }
  }

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
