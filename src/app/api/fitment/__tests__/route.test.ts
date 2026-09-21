/** UNI-2748: the read route enforces auth and the customer audience. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/data-scope', () => ({ requireAuthScope: vi.fn() }));
vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(async () => ['user-a']),
}));
vi.mock('@/lib/fitment/fitment-service', async (orig) => {
  const real = await orig<typeof import('@/lib/fitment/fitment-service')>();
  return { ...real, listFitsForMachine: vi.fn(), listFitments: vi.fn() };
});

import { requireAuthScope } from '@/lib/auth/data-scope';
import * as svc from '@/lib/fitment/fitment-service';
import { GET } from '@/app/api/fitment/route';

const product = (id: string) => ({ id, name: id, sku: id, category: null, price: 1 });
const row = {
  id: 'f1',
  kind: 'consumable',
  status: 'confirmed',
  source: 'bom',
  evidence: 'x',
  usageQuantity: null,
  usagePer: null,
  confirmedAt: null,
  machineProduct: product('m'),
  fitProduct: product('p'),
};
const req = (qs: string) => new NextRequest(`http://localhost/api/fitment${qs}`);

beforeEach(() => {
  vi.mocked(requireAuthScope).mockResolvedValue({
    userId: 'user-a',
    role: 'member',
    isAdmin: false,
  } as never);
  vi.mocked(svc.listFitsForMachine).mockResolvedValue([row] as never);
});

describe('GET /api/fitment', () => {
  it('401 without a session', async () => {
    vi.mocked(requireAuthScope).mockResolvedValue(null);
    expect((await GET(req('?machine_product_id=m'))).status).toBe(401);
  });

  it('passes the customer audience through and returns the customer shape', async () => {
    const res = await GET(req('?machine_product_id=m&audience=customer'));
    expect(svc.listFitsForMachine).toHaveBeenCalledWith(['user-a'], 'm', 'customer');
    const body = await res.json();
    expect(body.items[0]).not.toHaveProperty('status');
    expect(body.items[0]).not.toHaveProperty('evidence');
  });

  it('defaults to the staff audience', async () => {
    await GET(req('?machine_product_id=m'));
    expect(svc.listFitsForMachine).toHaveBeenCalledWith(['user-a'], 'm', 'staff');
  });

  it('refuses the unscoped list to the customer audience', async () => {
    expect((await GET(req('?audience=customer'))).status).toBe(400);
    expect(svc.listFitments).not.toHaveBeenCalled();
  });
});
