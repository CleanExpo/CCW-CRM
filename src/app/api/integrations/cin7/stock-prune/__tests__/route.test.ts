import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/integrations/cin7-stock-stability', () => ({
  CIN7_STOCK_PRUNE_LOCKED_DETAIL:
    'Stock prune is locked until three consecutive complete acceptance runs show a stable Cin7 stock row count.',
  getCin7StockStability: vi.fn(),
}));

vi.mock('@/lib/integrations/cin7-heal-audit', () => ({
  runAuditedStockPrune: vi.fn(),
}));

vi.mock('@/lib/integrations/cin7-omni', () => ({
  getCin7OmniCredentials: vi.fn(),
  pingCin7Omni: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    cin7StockLevel: { count: vi.fn() },
    cin7SyncRun: { updateMany: vi.fn() },
  },
}));

vi.mock('@/lib/integrations/cin7-reconciliation-cache', () => ({
  clearCachedReconciliation: vi.fn(),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { runAuditedStockPrune } from '@/lib/integrations/cin7-heal-audit';
import { getCin7StockStability } from '@/lib/integrations/cin7-stock-stability';
import { POST } from '../route';

describe('POST /api/integrations/cin7/stock-prune', () => {
  beforeEach(() => {
    vi.mocked(requireAuthScope).mockResolvedValue({
      userId: 'owner-1',
      role: 'owner',
      isAdmin: true,
    } as never);
    vi.mocked(getCin7StockStability).mockReset();
    vi.mocked(runAuditedStockPrune).mockReset();
  });

  it('refuses prune with 409 until Cin7 stock counts are stable', async () => {
    vi.mocked(getCin7StockStability).mockResolvedValue({
      stable: false,
      prune_enabled: false,
      required: 3,
      observed: 1,
      cin7_counts: [9805],
      reason: 'Need 3 consecutive complete acceptance runs',
      runs: [],
      last_prune_audit: null,
      revert_how: 'revert from audit',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/integrations/cin7/stock-prune', { method: 'POST' })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.prune_enabled).toBe(false);
    expect(body.detail).toMatch(/locked/i);
    expect(runAuditedStockPrune).not.toHaveBeenCalled();
  });
});
