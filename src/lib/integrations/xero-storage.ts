import { prisma } from '@/lib/db/prisma';
import type { XeroTokenSet } from '@/lib/integrations/xero-oauth';

export type StoredXeroConnection = {
  workspaceId: string;
  tenantId: string;
  tenantName: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
};

function workspaceXero() {
  return (prisma as { workspaceXeroConnection?: typeof prisma.workspaceXeroConnection })
    .workspaceXeroConnection;
}

export async function loadWorkspaceXeroConnection(
  workspaceId: string
): Promise<StoredXeroConnection | null> {
  const model = workspaceXero();
  if (!model) return null;
  const row = await model.findUnique({ where: { workspaceId } });
  if (!row) return null;
  return {
    workspaceId: row.workspaceId,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    tokenExpiresAt: row.tokenExpiresAt,
  };
}

export async function saveWorkspaceXeroConnection(input: {
  workspaceId: string;
  tenantId: string;
  tenantName: string | null;
  tokens: XeroTokenSet;
  connectedByUserId?: string;
}): Promise<void> {
  const model = workspaceXero();
  if (!model) {
    throw new Error(
      'Workspace Xero storage is unavailable. Run `pnpm exec prisma generate` and restart the dev server.'
    );
  }
  const { workspaceId, tenantId, tenantName, tokens, connectedByUserId } = input;
  await model.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      tenantId,
      tenantName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt,
      connectedByUserId: connectedByUserId ?? null,
    },
    update: {
      tenantId,
      tenantName,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.expiresAt,
      connectedByUserId: connectedByUserId ?? null,
    },
  });
}

export async function clearWorkspaceXeroConnection(workspaceId: string): Promise<void> {
  const model = workspaceXero();
  if (!model) return;
  await model.deleteMany({ where: { workspaceId } });
}

export function isXeroTokenExpired(expiresAt: Date | null, skewSeconds = 120): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now() + skewSeconds * 1000;
}
