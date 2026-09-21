/**
 * UNI-2749: the live radar and the reporting extract must give the same list
 * for the same as-of date. Both read the same seeded invoices through a prisma
 * fake that evaluates the filters it is sent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Inv = {
  id: string;
  ownerUserId: string;
  invoiceNumber: string;
  customerId: string;
  branchName: string | null;
  invoiceDate: Date;
  status: string;
  items: { productId: string; quantity: number; unitPrice: number; lineTotal: number }[];
};

const db = vi.hoisted(() => ({
  invoices: [] as Inv[],
  activities: [] as Record<string, unknown>[],
}));

function matchInvoice(inv: Inv, where: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(where)) {
    const c = v as Record<string, unknown>;
    if (k === 'ownerUserId') {
      if (!(c.in as string[]).includes(inv.ownerUserId)) return false;
    } else if (k === 'invoiceDate') {
      if (inv.invoiceDate.getTime() > (c.lte as Date).getTime()) return false;
    } else if (k === 'status') {
      if ((c.notIn as string[]).includes(inv.status)) return false;
    } else {
      throw new Error(`fake prisma: invoice.${k}`);
    }
  }
  return true;
}

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    invoice: {
      findMany: vi.fn(
        async ({
          where,
          orderBy,
          skip,
          take,
        }: {
          where: Record<string, unknown>;
          orderBy?: unknown;
          skip?: number;
          take?: number;
        }) => {
          let rows = db.invoices.filter((i) => matchInvoice(i, where));
          if (orderBy !== undefined) {
            // Only the extract's order is supported: newest invoice first, then id descending.
            expect(orderBy).toEqual([{ invoiceDate: 'desc' }, { id: 'desc' }]);
            rows = [...rows].sort(
              (a, b) => b.invoiceDate.getTime() - a.invoiceDate.getTime() || (a.id < b.id ? 1 : -1)
            );
          }
          rows = rows.slice(skip ?? 0, take === undefined ? undefined : (skip ?? 0) + take);
          return rows.map((i) => ({
            ...i,
            items: i.items.map((it) => ({ ...it, product: { sku: it.productId.toUpperCase() } })),
          }));
        }
      ),
    },
    stockMovement: { findMany: vi.fn(async () => []) },
    customer: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; ownerUserId: { in: string[] } } }) =>
          where.id === 'c30' && where.ownerUserId.in.includes('user-a') ? { id: 'c30' } : null
      ),
    },
    product: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => ({ name: 'Soap' })) },
    workshopEquipment: { findMany: vi.fn(async () => []) },
    crmActivity: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        db.activities.push(data);
        return { id: 'act-1', ...data };
      }),
    },
  },
}));
vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(async () => ({ userId: 'user-a', role: 'owner', isAdmin: false })),
}));
vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceMemberUserIds: vi.fn(async () => ['user-a']),
}));

import {
  getInventoryForecast,
  loadPurchaseLines,
  logCallOutcome,
} from '@/lib/reorder-radar/radar-service';
import { buildRadar, radarLinesFromExtract } from '@/lib/reorder-radar/cadence';
import { GET as extractGET } from '@/app/api/reporting/extract/route';
import { INVOICE_PAGE_SIZE, type ReportingExtract } from '@/lib/reporting/transaction-extract';

let n = 0;
function inv(
  customerId: string,
  date: string,
  status: string,
  items: [string, number][],
  owner = 'user-a'
): Inv {
  n++;
  return {
    id: `inv-${n}`,
    ownerUserId: owner,
    invoiceNumber: `INV-${n}`,
    customerId,
    branchName: null,
    invoiceDate: new Date(`${date}T00:00:00Z`),
    status,
    items: items.map(([productId, quantity]) => ({
      productId,
      quantity,
      unitPrice: 5,
      lineTotal: 5 * quantity,
    })),
  };
}

beforeEach(() => {
  db.activities = [];
  db.invoices = [
    inv('c30', '2026-01-01', 'paid', [['soap', 4]]),
    inv('c30', '2026-01-31', 'paid', [
      ['soap', 4],
      ['wax', 1],
    ]),
    inv('c30', '2026-03-02', 'sent', [['soap', 4]]),
    inv('c30', '2026-03-20', 'draft', [['soap', 4]]), // draft: not a purchase
    inv('c30', '2026-03-28', 'paid', [['soap', 4]]), // after as-of
    inv('c7', '2026-01-01', 'paid', [['wax', 2]]),
    inv('c7', '2026-01-08', 'cancelled', [['wax', 2]]),
    inv('c7', '2026-01-15', 'paid', [['wax', 2]]),
    inv('c7', '2026-01-22', 'paid', [['wax', 2]]),
    inv('c1', '2026-03-01', 'paid', [['soap', 10]]),
    inv('cx', '2026-01-01', 'paid', [['soap', 1]], 'user-other'),
    inv('cx', '2026-01-31', 'paid', [['soap', 1]], 'user-other'),
    inv('cx', '2026-03-02', 'paid', [['soap', 1]], 'user-other'),
  ];
});

const AS_OF = '2026-03-25';

/** Reads every extract page for an as-of date, the way a replay must. */
async function extractAllLines(asOf: string, maxPages = 50) {
  const lines: ReportingExtract['invoice_lines'] = [];
  for (let page = 1; page <= maxPages; page++) {
    const res = await extractGET(
      new NextRequest(`http://localhost/api/reporting/extract?as_of=${asOf}&page=${page}`)
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReportingExtract;
    expect(body.invoice_page).toBe(page);
    lines.push(...body.invoice_lines);
    if (!body.invoice_next_page) return { lines, pages: page };
  }
  throw new Error('extract never reached its last page');
}

describe('live radar vs reporting extract', () => {
  it('produce the same radar for the same as-of date', async () => {
    const live = buildRadar(await loadPurchaseLines(['user-a'], AS_OF), AS_OF);

    const { lines } = await extractAllLines(AS_OF);
    const replay = buildRadar(radarLinesFromExtract(lines), AS_OF);

    expect(replay).toEqual(live);
    // Not vacuous: the seeded 30-day customer is actually due on this date.
    expect(live.due.map((c) => `${c.customerId}:${c.productId}`)).toEqual(['c30:soap']);
  });

  it('stays equal to the live radar when the history is longer than one extract page', async () => {
    // Older daily history for another customer pushes the invoice count past one page.
    const start = Date.UTC(2025, 11, 31);
    for (let i = 0; i < INVOICE_PAGE_SIZE + 50; i++) {
      const day = new Date(start - i * 86_400_000).toISOString().slice(0, 10);
      db.invoices.push(inv('bulk', day, 'paid', [['wax', 1]]));
    }
    const liveLines = await loadPurchaseLines(['user-a'], AS_OF);
    const live = buildRadar(liveLines, AS_OF);

    const { lines, pages } = await extractAllLines(AS_OF);
    expect(pages).toBeGreaterThan(1);
    const replayLines = radarLinesFromExtract(lines);
    expect(replayLines).toHaveLength(liveLines.length);
    expect(buildRadar(replayLines, AS_OF)).toEqual(live);

    // Control: page 1 alone is truncated, so it cannot stand in for the live read.
    const first = (await (
      await extractGET(new NextRequest(`http://localhost/api/reporting/extract?as_of=${AS_OF}`))
    ).json()) as ReportingExtract;
    expect(first.invoice_next_page).toBe(2);
    expect(radarLinesFromExtract(first.invoice_lines).length).toBeLessThan(liveLines.length);
  });

  it('the extract filters to the as-of day and rejects a date that does not exist', async () => {
    const { lines } = await extractAllLines(AS_OF);
    expect(lines.some((l) => l.invoice_date > AS_OF)).toBe(false);
    const bad = await extractGET(
      new NextRequest('http://localhost/api/reporting/extract?as_of=2026-02-30')
    );
    expect(bad.status).toBe(400);
  });

  it('live read excludes draft and cancelled invoices, other workspaces and later lines', async () => {
    const lines = await loadPurchaseLines(['user-a'], AS_OF);
    expect(lines.some((l) => l.date === '2026-03-20')).toBe(false);
    expect(lines.some((l) => l.date === '2026-01-08')).toBe(false);
    expect(lines.some((l) => l.date === '2026-03-28')).toBe(false);
    expect(lines.some((l) => l.customerId === 'cx')).toBe(false);
  });

  it('includes an invoice dated exactly on the as-of day', async () => {
    db.invoices.push(inv('c30', AS_OF, 'paid', [['soap', 4]]));
    const lines = await loadPurchaseLines(['user-a'], AS_OF);
    expect(lines.some((l) => l.date === AS_OF)).toBe(true);
  });

  it('the extract CSV keeps its exact columns; invoice_status is JSON only', async () => {
    const res = await extractGET(
      new NextRequest('http://localhost/api/reporting/extract?format=csv')
    );
    const [header, firstRow] = (await res.text()).split('\n');
    expect(header).toBe('kind,id,ref,branch_name,sku,quantity,unit_price,line_total,occurred_at');
    expect(header).not.toContain('invoice_status');
    expect(firstRow.split(',')).toHaveLength(9);
  });
});

describe('getInventoryForecast', () => {
  it('turns cadence into real demand: 4 soap every 30 days with 12 in stock lasts 90 days', async () => {
    const { prisma } = await import('@/lib/db/prisma');
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { id: 'soap', name: 'Soap', sku: 'SOAP', stock: 12, price: 5 },
    ] as never);
    const res = await getInventoryForecast(['user-a'], AS_OF, { forecastDays: 30 });
    expect(res.total_products_analyzed).toBe(1);
    const [f] = res.forecasts;
    expect(f.sales_velocity.avg_daily_sales).toBeCloseTo(4 / 30, 3);
    expect(f.forecast.days_until_depletion).toBe(90);
    expect(f.forecast.depletion_date).toBe('2026-06-23');
    expect(f.recommendation.needs_reorder).toBe(false);
  });
});

describe('logCallOutcome', () => {
  it('writes a completed call activity against the customer', async () => {
    const row = await logCallOutcome(['user-a'], 'staff-1', {
      customerId: 'c30',
      outcome: 'ordered',
      productId: 'soap',
    });
    expect(row).not.toBeNull();
    expect(db.activities[0]).toMatchObject({
      activityType: 'call',
      subject: 'Reorder call: Ordered (Soap)',
      customerId: 'c30',
      createdBy: 'staff-1',
    });
    expect(db.activities[0].completedAt).toBeInstanceOf(Date);
  });

  it('refuses an unknown outcome and a customer outside the workspace', async () => {
    await expect(
      logCallOutcome(['user-a'], 's', { customerId: 'c30', outcome: 'maybe' })
    ).rejects.toThrow('Invalid outcome');
    expect(
      await logCallOutcome(['user-a'], 's', { customerId: 'cx', outcome: 'ordered' })
    ).toBeNull();
    expect(db.activities).toHaveLength(0);
  });
});
