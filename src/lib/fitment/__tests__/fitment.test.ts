/**
 * UNI-2748: seeded tests for the machine-to-consumables and parts map.
 *
 * The prisma mock interprets the `where` clauses the service sends and throws on
 * any key it does not understand, so a filter the service forgets (or one this
 * fake cannot evaluate) fails the test instead of passing silently.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type P = {
  id: string;
  ownerUserId: string;
  name: string;
  sku: string;
  category: string | null;
  price: number;
  isActive: boolean;
};
type F = {
  id: string;
  ownerUserId: string;
  machineProductId: string;
  fitProductId: string;
  kind: string;
  status: string;
  source: string;
  usageQuantity: number | null;
  usagePer: string | null;
  evidence: string | null;
  confirmedBy: string | null;
  confirmedAt: Date | null;
};

const db = vi.hoisted(() => ({
  products: [] as P[],
  fitments: [] as F[],
  equipment: [] as { id: string; ownerUserId: string; productId: string | null }[],
}));

function matchValue(actual: unknown, cond: unknown): boolean {
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
    for (const [k, v] of Object.entries(cond as Record<string, unknown>)) {
      if (k === 'in') {
        if (!(v as unknown[]).includes(actual)) return false;
      } else if (k === 'not') {
        if (actual === v) return false;
      } else {
        throw new Error(`fake prisma: unsupported operator ${k}`);
      }
    }
    return true;
  }
  return actual === cond;
}

function matchProduct(p: P | undefined, where: Record<string, unknown>): boolean {
  if (!p) return false;
  for (const [k, v] of Object.entries(where)) {
    if (!['id', 'ownerUserId', 'isActive', 'sku'].includes(k))
      throw new Error(`fake prisma: product.${k}`);
    if (!matchValue(p[k as keyof P], v)) return false;
  }
  return true;
}

function matchFitment(f: F, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (k === 'fitProduct' || k === 'machineProduct') {
      const pid = k === 'fitProduct' ? f.fitProductId : f.machineProductId;
      if (
        !matchProduct(
          db.products.find((p) => p.id === pid),
          v as Record<string, unknown>
        )
      )
        return false;
    } else if (['id', 'ownerUserId', 'machineProductId', 'fitProductId', 'status'].includes(k)) {
      if (!matchValue(f[k as keyof F], v)) return false;
    } else {
      throw new Error(`fake prisma: fitment.${k}`);
    }
  }
  return true;
}

function withProducts(f: F) {
  return {
    ...f,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    machineProduct: db.products.find((p) => p.id === f.machineProductId)!,
    fitProduct: db.products.find((p) => p.id === f.fitProductId)!,
  };
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    productFitment: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        db.fitments.filter((f) => matchFitment(f, where)).map(withProducts)
      ),
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          db.fitments.find((f) => matchFitment(f, where)) ?? null
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<F> }) => {
        const f = db.fitments.find((x) => x.id === where.id)!;
        Object.assign(f, data);
        return withProducts(f);
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const before = db.fitments.length;
        db.fitments = db.fitments.filter((f) => !matchFitment(f, where));
        return { count: before - db.fitments.length };
      }),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: {
            machineProductId_fitProductId: { machineProductId: string; fitProductId: string };
          };
          create: Omit<F, 'id'>;
          update: Partial<F>;
        }) => {
          const k = where.machineProductId_fitProductId;
          const hit = db.fitments.find(
            (f) => f.machineProductId === k.machineProductId && f.fitProductId === k.fitProductId
          );
          if (hit) return Object.assign(hit, update);
          const row = { id: `up-${db.fitments.length}`, ...create } as F;
          db.fitments.push(row);
          return row;
        }
      ),
      createMany: vi.fn(async ({ data }: { data: Omit<F, 'id'>[] }) => {
        data.forEach((d, i) => db.fitments.push({ id: `new-${i}`, ...d } as F));
        return { count: data.length };
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: Partial<F> }) => {
          const hits = db.fitments.filter((f) => matchFitment(f, where));
          hits.forEach((f) => Object.assign(f, data));
          return { count: hits.length };
        }
      ),
      // Behaves like the (machine_product_id, fit_product_id) unique index.
      create: vi.fn(async ({ data }: { data: Omit<F, 'id'> }) => {
        if (
          db.fitments.some(
            (f) =>
              f.machineProductId === data.machineProductId && f.fitProductId === data.fitProductId
          )
        ) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        const row = { id: `cr-${db.fitments.length}`, ...data } as F;
        db.fitments.push(row);
        return row;
      }),
    },
    product: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        db.products.filter((p) => matchProduct(p, where))
      ),
    },
    workshopEquipment: {
      findFirst: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          db.equipment.find(
            (e) => matchValue(e.id, where.id) && matchValue(e.ownerUserId, where.ownerUserId)
          ) ?? null
      ),
      findMany: vi.fn(async () => db.equipment.filter((e) => e.productId)),
    },
    cin7BomMaster: { findMany: vi.fn(async () => []) },
    order: { findMany: vi.fn(async () => []) },
  },
}));

import {
  listFitsForEquipment,
  listFitsForMachine,
  reviewFitment,
  deleteFitment,
  generateSuggestions,
  fitmentToCustomerApi,
  importFitments,
  createFitment,
  FitmentInputError,
  listMachinesForProduct,
} from '@/lib/fitment/fitment-service';
import { prisma } from '@/lib/db/prisma';

const WS = ['user-a'];
const OTHER = 'user-other';

function product(id: string, over: Partial<P> = {}): P {
  return {
    id,
    ownerUserId: 'user-a',
    name: id,
    sku: id.toUpperCase(),
    category: null,
    price: 10,
    isActive: true,
    ...over,
  };
}
function fit(id: string, machine: string, fitP: string, status: string, over: Partial<F> = {}): F {
  return {
    id,
    ownerUserId: 'user-a',
    machineProductId: machine,
    fitProductId: fitP,
    kind: 'consumable',
    status,
    source: 'manual',
    usageQuantity: null,
    usagePer: null,
    evidence: null,
    confirmedBy: null,
    confirmedAt: null,
    ...over,
  };
}

beforeEach(() => {
  db.products = [
    product('machine-x', { category: 'heavy_machinery' }),
    product('machine-y', { category: 'heavy_machinery' }),
    product('filter'),
    product('detergent'),
    product('hose'),
    product('old-nozzle', { isActive: false }),
    product('foreign', { ownerUserId: OTHER }),
  ];
  db.fitments = [
    fit('f1', 'machine-x', 'filter', 'confirmed'),
    fit('f2', 'machine-x', 'detergent', 'confirmed'),
    fit('f3', 'machine-x', 'hose', 'suggested', { source: 'order_history' }),
    fit('f4', 'machine-x', 'old-nozzle', 'confirmed'),
    fit('f5', 'machine-x', 'foreign', 'confirmed', { ownerUserId: OTHER }),
    fit('f6', 'machine-y', 'filter', 'confirmed'),
    fit('f7', 'machine-x', 'machine-y', 'rejected'),
  ];
  db.equipment = [
    { id: 'eq-linked', ownerUserId: 'user-a', productId: 'machine-x' },
    { id: 'eq-unlinked', ownerUserId: 'user-a', productId: null },
    { id: 'eq-foreign', ownerUserId: OTHER, productId: 'machine-x' },
  ];
});

const ids = (rows: { fitProductId: string }[]) => rows.map((r) => r.fitProductId).sort();

describe('listFitsForMachine', () => {
  it('customer audience returns exactly the confirmed, active products for machine X', async () => {
    const rows = await listFitsForMachine(WS, 'machine-x', 'customer');
    expect(ids(rows)).toEqual(['detergent', 'filter']);
  });

  it('never shows a suggested or rejected row to a customer', async () => {
    const rows = await listFitsForMachine(WS, 'machine-x', 'customer');
    expect(rows.every((r) => r.status === 'confirmed')).toBe(true);
    expect(ids(rows)).not.toContain('hose');
    expect(ids(rows)).not.toContain('machine-y');
  });

  it('staff audience also sees suggestions, but not rejected rows', async () => {
    const rows = await listFitsForMachine(WS, 'machine-x', 'staff');
    expect(ids(rows)).toEqual(['detergent', 'filter', 'hose', 'old-nozzle']);
  });

  it('excludes rows owned outside the workspace', async () => {
    const rows = await listFitsForMachine(WS, 'machine-x', 'staff');
    expect(ids(rows)).not.toContain('foreign');
  });

  it('the customer shape carries no status, source or evidence', async () => {
    const [row] = await listFitsForMachine(WS, 'machine-x', 'customer');
    const out = fitmentToCustomerApi(row);
    expect(Object.keys(out).sort()).toEqual(['kind', 'product', 'usage_per', 'usage_quantity']);
  });
});

describe('listFitsForEquipment', () => {
  it('maps a customer machine through its machine product', async () => {
    const res = await listFitsForEquipment(WS, 'eq-linked', 'customer');
    expect(res?.linked).toBe(true);
    expect(ids(res!.fits)).toEqual(['detergent', 'filter']);
  });

  it('says so when the machine is not linked to a product, rather than returning an empty map', async () => {
    const res = await listFitsForEquipment(WS, 'eq-unlinked', 'staff');
    expect(res).toEqual({ linked: false, machineProductId: null, fits: [] });
  });

  it('returns null for equipment outside the workspace', async () => {
    expect(await listFitsForEquipment(WS, 'eq-foreign', 'staff')).toBeNull();
  });
});

describe('reviewFitment', () => {
  it('confirming a suggestion makes it visible to customers and records who confirmed', async () => {
    await reviewFitment(WS, 'staff-1', 'f3', { status: 'confirmed' });
    const rows = await listFitsForMachine(WS, 'machine-x', 'customer');
    expect(ids(rows)).toContain('hose');
    expect(db.fitments.find((f) => f.id === 'f3')?.confirmedBy).toBe('staff-1');
  });

  it('cannot touch a row in another workspace', async () => {
    expect(await reviewFitment(WS, 'staff-1', 'f5', { status: 'rejected' })).toBeNull();
    expect(await deleteFitment(WS, 'f5')).toBe(false);
    expect(db.fitments.find((f) => f.id === 'f5')?.status).toBe('confirmed');
  });

  it('rejects an unknown status', async () => {
    await expect(reviewFitment(WS, 'staff-1', 'f3', { status: 'live' })).rejects.toThrow(
      'Invalid status'
    );
  });
});

describe('generateSuggestions', () => {
  it('drafts rows as suggested and leaves existing decisions alone', async () => {
    vi.mocked(prisma.cin7BomMaster.findMany).mockResolvedValueOnce([
      {
        sku: 'BOM-X',
        finishedGoodSku: 'MACHINE-X',
        components: [
          { componentSku: 'FILTER', quantity: '1', uom: 'EA' },
          { componentSku: 'DETERGENT', quantity: '2', uom: 'L' },
        ],
      },
      {
        sku: 'BOM-Y',
        finishedGoodSku: 'MACHINE-Y',
        components: [{ componentSku: 'HOSE', quantity: '1', uom: 'EA' }],
      },
    ] as never);
    const res = await generateSuggestions(WS, 'staff-1');
    expect(res).toEqual({ fromBom: 1, fromOrders: 0, skippedExisting: 2 });
    const added = db.fitments.filter((f) => f.id.startsWith('new-'));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      machineProductId: 'machine-y',
      fitProductId: 'hose',
      status: 'suggested',
      source: 'bom',
      kind: 'part',
    });
    expect(db.fitments.find((f) => f.id === 'f1')?.status).toBe('confirmed');
  });
});

describe('importFitments', () => {
  const row = (line: number, machineSku: string, fitSku: string) => ({
    line,
    machineSku,
    fitSku,
    kind: 'consumable' as const,
    usageQuantity: null,
    usagePer: null,
  });

  it('an unconfirmed sheet never downgrades a staff decision, and says so per line', async () => {
    const res = await importFitments(
      WS,
      'staff-1',
      [
        row(2, 'MACHINE-X', 'FILTER'), // confirmed by staff
        row(3, 'MACHINE-X', 'MACHINE-Y'), // rejected by staff
        row(4, 'MACHINE-Y', 'HOSE'), // new pair
      ],
      { confirm: false }
    );
    expect(db.fitments.find((f) => f.id === 'f1')?.status).toBe('confirmed');
    expect(db.fitments.find((f) => f.id === 'f7')?.status).toBe('rejected');
    expect(res.errors.map((e) => e.line)).toEqual([2, 3]);
    expect(res.imported).toBe(1);
    const added = db.fitments.find(
      (f) => f.machineProductId === 'machine-y' && f.fitProductId === 'hose'
    );
    expect(added?.status).toBe('suggested');
  });

  it('a confirmation that lands mid-import is not overwritten by an unconfirmed sheet', async () => {
    // Staff confirm the hose suggestion AFTER the import read its snapshot but before
    // it writes. Simulated by confirming on the first write attempt.
    const { prisma: p } = await import('@/lib/db/prisma');
    vi.mocked(p.productFitment.updateMany).mockImplementationOnce((async () => {
      db.fitments.find((f) => f.id === 'f3')!.status = 'confirmed';
      return { count: 0 };
    }) as never);
    const res = await importFitments(WS, 'staff-1', [row(2, 'MACHINE-X', 'HOSE')], {
      confirm: false,
    });
    expect(db.fitments.find((f) => f.id === 'f3')?.status).toBe('confirmed');
    expect(res.imported).toBe(0);
    expect(res.errors[0].line).toBe(2);
  });

  it('a sheet explicitly marked confirmed may overwrite a decision', async () => {
    await importFitments(WS, 'staff-1', [row(2, 'MACHINE-X', 'MACHINE-Y')], { confirm: true });
    expect(db.fitments.find((f) => f.id === 'f7')?.status).toBe('confirmed');
  });
});

describe('listMachinesForProduct', () => {
  it('customer audience never lists an inactive machine; staff still sees it', async () => {
    db.products.push(product('old-machine', { isActive: false }));
    db.fitments.push(fit('f9', 'old-machine', 'filter', 'confirmed'));
    const ids = async (audience: 'customer' | 'staff') =>
      (await listMachinesForProduct(WS, 'filter', audience)).map((r) => r.machineProductId).sort();
    expect(await ids('customer')).toEqual(['machine-x', 'machine-y']);
    expect(await ids('staff')).toContain('old-machine');
  });
});

describe('createFitment', () => {
  it('rejects a zero, negative or non-numeric usage quantity', async () => {
    for (const q of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        createFitment(WS, 'staff-1', {
          machineProductId: 'machine-y',
          fitProductId: 'hose',
          kind: 'consumable',
          usageQuantity: q,
        })
      ).rejects.toBeInstanceOf(FitmentInputError);
    }
  });
});
