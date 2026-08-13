import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/integrations/cin7-recon-snapshot-store', () => ({
  getImmutableReconSnapshot: vi.fn(),
  listImmutableReconSnapshots: vi.fn(),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import {
  getImmutableReconSnapshot,
  listImmutableReconSnapshots,
} from '@/lib/integrations/cin7-recon-snapshot-store';
import { GET } from '../route';

describe('GET /api/integrations/cin7/reconciliation/history', () => {
  beforeEach(() => {
    vi.mocked(requireAuthScope).mockResolvedValue({
      userId: 'owner-1',
      role: 'owner',
      isAdmin: true,
    } as never);
    vi.mocked(getImmutableReconSnapshot).mockReset();
    vi.mocked(listImmutableReconSnapshots).mockReset();
  });

  it('returns a stored snapshot by id without re-running recon', async () => {
    vi.mocked(getImmutableReconSnapshot).mockResolvedValue({
      recon_run_id: 'snap-1',
      mode: 'acceptance',
      source: 'omni',
      checked_at: '2026-08-13T08:20:52.000Z',
      notes: ['stored'],
      fetch_meta: { errors: [] },
    } as never);

    const response = await GET(
      new NextRequest('http://localhost/api/integrations/cin7/reconciliation/history?id=snap-1')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recon_run_id).toBe('snap-1');
    expect(getImmutableReconSnapshot).toHaveBeenCalledWith('owner-1', 'snap-1');
    expect(listImmutableReconSnapshots).not.toHaveBeenCalled();
  });

  it('lists stored snapshots for the account', async () => {
    vi.mocked(listImmutableReconSnapshots).mockResolvedValue([
      {
        id: 'snap-1',
        mode: 'acceptance',
        status: 'complete',
        checked_at: '2026-08-13T08:20:52.000Z',
        immutable: true,
        missing_count: 1,
        extra_count: 0,
        field_mismatch_count: 0,
        products_cin7: 10,
        products_optix: 9,
        stock_cin7: 9805,
        stock_optix: 13749,
        stock_reported_total: 10542,
        stock_truncated: true,
      },
    ]);

    const response = await GET(
      new NextRequest('http://localhost/api/integrations/cin7/reconciliation/history?limit=20')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].stock_cin7).toBe(9805);
  });
});
