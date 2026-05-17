import { prisma } from '@/lib/db/prisma';
import { refreshXeroAccessToken } from '@/lib/integrations/xero-oauth';
import { isXeroTokenExpired, saveWorkspaceXeroConnection } from '@/lib/integrations/xero-storage';

export async function refreshAllWorkspaceXeroTokens(): Promise<{
  refreshed: number;
  skipped: number;
  errors: string[];
}> {
  const model = (
    prisma as { workspaceXeroConnection?: typeof prisma.workspaceXeroConnection }
  ).workspaceXeroConnection;
  if (!model) {
    return {
      refreshed: 0,
      skipped: 0,
      errors: ['Prisma client missing workspaceXeroConnection — run prisma generate and restart.'],
    };
  }
  const rows = await model.findMany();
  let refreshed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    if (!row.refreshToken) {
      skipped += 1;
      continue;
    }
    if (!isXeroTokenExpired(row.tokenExpiresAt, 60 * 5)) {
      skipped += 1;
      continue;
    }
    try {
      const tokens = await refreshXeroAccessToken(row.refreshToken);
      await saveWorkspaceXeroConnection({
        workspaceId: row.workspaceId,
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        tokens,
      });
      refreshed += 1;
    } catch (e) {
      errors.push(
        `${row.workspaceId}: ${e instanceof Error ? e.message : 'refresh failed'}`
      );
    }
  }

  return { refreshed, skipped, errors };
}
