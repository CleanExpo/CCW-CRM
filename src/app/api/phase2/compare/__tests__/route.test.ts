import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));
vi.mock('@/lib/phase2/run', () => ({
  parsePhase2Area: vi.fn((raw: string | null) => {
    const n = Number(raw);
    return n >= 1 && n <= 8 ? n : null;
  }),
  persistPhase2Snapshot: vi.fn(async () => 'run-1'),
  runPhase2Area: vi.fn(async () => ({
    area: 1,
    title: 'Inventory quantities by warehouse',
    as_of: '2026-09-22T00:00:00.000Z',
    read_only: true,
    cin7_is_source_of_truth: true,
    clean: false,
    blocked: true,
    blocked_reason: 'Incomplete Cin7 stock pull cannot be treated as a clean result.',
    cin7_complete: false,
    company: { cin7: 0, optix: 0, difference: 0 },
    sku_count: { cin7: 0, optix: 0 },
    warehouse_count: { cin7: 0, optix: 0 },
    warehouses: [],
    counts: { missing: 0, extra: 0, quantity_mismatch: 0, timing: 0, skipped: 0 },
    sample: [],
    notes: [],
    source_of_truth: { cin7: 'cin7', optix: 'optix' },
  })),
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { runPhase2Area } from '@/lib/phase2/run';
import { POST } from '../route';

describe('POST /api/phase2/compare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    const res = await POST(
      new NextRequest('http://localhost/api/phase2/compare?area=1', { method: 'POST' })
    );
    expect(res.status).toBe(401);
  });

  it('rejects a member', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue({
      userId: 'u1',
      role: 'member',
      isAdmin: false,
    });
    const res = await POST(
      new NextRequest('http://localhost/api/phase2/compare?area=1', { method: 'POST' })
    );
    expect(res.status).toBe(403);
  });

  it('runs Area 1 for an admin and stores a snapshot', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue({
      userId: 'u1',
      role: 'admin',
      isAdmin: true,
    });
    const res = await POST(
      new NextRequest('http://localhost/api/phase2/compare?area=1', { method: 'POST' })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.area).toBe(1);
    expect(body.read_only).toBe(true);
    expect(body.recon_run_id).toBe('run-1');
    expect(body.clean).toBe(false);
  });

  it('fails closed when the compare throws', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue({
      userId: 'u1',
      role: 'admin',
      isAdmin: true,
    });
    vi.mocked(runPhase2Area).mockRejectedValueOnce(new Error('cin7 down'));
    const res = await POST(
      new NextRequest('http://localhost/api/phase2/compare?area=1', { method: 'POST' })
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.clean).toBe(false);
  });
});
