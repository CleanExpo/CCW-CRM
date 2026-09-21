/** UNI-2750: service plans against an in-memory prisma fake. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Booking = {
  id: string;
  equipmentId: string;
  ownerUserId: string;
  status: string;
  serviceTemplateId: string | null;
  parts: { productId: string; quantity: number; source: string }[];
};

const db = vi.hoisted(() => ({
  equipment: [] as Record<string, unknown>[],
  plans: [] as Record<string, unknown>[],
  bookings: [] as Booking[],
  templateItems: [] as { templateId: string; productId: string; quantity: number }[],
  invoiceWrites: 0,
  events: [] as string[],
}));

vi.mock('@/lib/db/prisma', () => {
  const client = {
    $executeRaw: vi.fn(async (_s: TemplateStringsArray, ...vals: unknown[]) => {
      db.events.push(`lock:${String(vals[0])}`);
      return 1;
    }),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(client)),
    workshopEquipment: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; ownerUserId: { in: string[] } } }) =>
          db.equipment.find(
            (e) => e.id === where.id && where.ownerUserId.in.includes(e.ownerUserId as string)
          ) ?? null
      ),
    },
    workshopServicePlan: {
      findFirst: vi.fn(
        async ({ where }: { where: { equipmentId: string; status: string } }) =>
          db.plans.find((p) => p.equipmentId === where.equipmentId && p.status === where.status) ??
          null
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'plan-new',
        ...data,
      })),
    },
    workshopBooking: {
      findFirst: vi.fn(
        async ({ where }: { where: { equipmentId: string; status: { in: string[] } } }) => {
          db.events.push('find-open');
          return (
            db.bookings.find(
              (b) => b.equipmentId === where.equipmentId && where.status.in.includes(b.status)
            ) ?? null
          );
        }
      ),
      count: vi.fn(async () => db.bookings.length),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { ownerUserId: string; equipmentId: string; serviceTemplateId: string | null };
        }) => {
          db.events.push('create');
          const b: Booking = {
            id: `bk-${db.bookings.length + 1}`,
            equipmentId: data.equipmentId,
            ownerUserId: data.ownerUserId,
            status: 'scheduled',
            serviceTemplateId: data.serviceTemplateId,
            parts: [],
          };
          db.bookings.push(b);
          return b;
        }
      ),
    },
    workshopServiceTemplateItem: {
      findMany: vi.fn(async ({ where }: { where: { templateId: string } }) =>
        db.templateItems.filter((i) => i.templateId === where.templateId)
      ),
    },
    workshopBookingPart: {
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: { bookingId: string; productId: string; quantity: number; source: string }[];
        }) => {
          for (const d of data) db.bookings.find((b) => b.id === d.bookingId)!.parts.push(d);
          return { count: data.length };
        }
      ),
    },
    invoice: {
      create: vi.fn(async () => {
        db.invoiceWrites++;
        return {};
      }),
    },
    workshopServiceTemplate: { findFirst: vi.fn(async () => ({ id: 'tpl-annual' })) },
  };
  return { prisma: client };
});

vi.mock('@/lib/fitment/fitment-service', () => ({
  listFitsForMachine: vi.fn(async (_ids: string[], machine: string, audience: string) => {
    if (audience !== 'customer') throw new Error('kit must use confirmed rows only');
    return machine === 'machine-x'
      ? [
          { fitProductId: 'filter', kind: 'consumable' },
          { fitProductId: 'seal', kind: 'part' },
          { fitProductId: 'trolley', kind: 'accessory' },
        ]
      : [];
  }),
}));

import {
  billableLabourHours,
  bookFromPlan,
  createInvoiceDraftFromBooking,
  createServicePlan,
  PlanInvoiceBlockedError,
} from '@/lib/workshop/service-plans';
import { sendPendingWorkshopReminders, sendWorkshopReminder } from '@/lib/db/workshop-service';
import { WorkshopOutreachBlockedError } from '@/lib/workshop/customer-outreach-gate';

const WS = ['user-a'];

beforeEach(() => {
  db.invoiceWrites = 0;
  db.events = [];
  db.equipment = [
    {
      id: 'eq-ready',
      ownerUserId: 'user-a',
      productId: 'machine-x',
      location: 'brisbane',
      nextServiceDate: new Date('2026-10-01T00:00:00Z'),
      recallCase: { status: 'ready_to_book' },
    },
    {
      id: 'eq-queued',
      ownerUserId: 'user-a',
      productId: 'machine-x',
      location: 'brisbane',
      nextServiceDate: null,
      recallCase: { status: 'queued' },
    },
    {
      id: 'eq-noplan',
      ownerUserId: 'user-a',
      productId: 'machine-x',
      location: 'brisbane',
      nextServiceDate: null,
      recallCase: { status: 'ready_to_book' },
    },
  ];
  db.plans = [
    { id: 'plan-1', equipmentId: 'eq-ready', status: 'active', serviceTemplateId: 'tpl-annual' },
    { id: 'plan-2', equipmentId: 'eq-queued', status: 'active', serviceTemplateId: 'tpl-annual' },
  ];
  db.bookings = [];
  db.templateItems = [
    { templateId: 'tpl-annual', productId: 'filter', quantity: 2 },
    { templateId: 'tpl-annual', productId: 'oil', quantity: 1 },
  ];
});

describe('bookFromPlan — one booking', () => {
  it('a ready machine on a plan gets exactly one booking with the plan template and the right kit', async () => {
    const first = await bookFromPlan(WS, 'staff-1', 'eq-ready');
    expect(first.created).toBe(true);
    expect(db.bookings).toHaveLength(1);
    expect(db.bookings[0].serviceTemplateId).toBe('tpl-annual');
    const kit = db.bookings[0].parts.map((p) => `${p.productId}:${p.quantity}:${p.source}`).sort();
    // template items win on quantity; confirmed map adds the seal; accessories are not kit
    expect(kit).toEqual(['filter:2:template', 'oil:1:template', 'seal:1:fitment']);
  });

  it('a second call returns the same open booking instead of making another', async () => {
    const a = await bookFromPlan(WS, 'staff-1', 'eq-ready');
    const b = await bookFromPlan(WS, 'staff-1', 'eq-ready');
    expect(b).toMatchObject({ created: false, bookingId: a.bookingId });
    expect(db.bookings).toHaveLength(1);
  });

  it('takes the per-machine lock before looking for an open booking, inside one transaction', async () => {
    await bookFromPlan(WS, 'staff-1', 'eq-ready');
    expect(db.events).toEqual(['lock:workshop-booking:eq-ready', 'find-open', 'create']);
  });

  it('refuses a machine recall review has not marked ready, and one with no plan', async () => {
    await expect(bookFromPlan(WS, 's', 'eq-queued')).rejects.toThrow(/ready to book/);
    await expect(bookFromPlan(WS, 's', 'eq-noplan')).rejects.toThrow(/no active service plan/);
    expect(db.bookings).toHaveLength(0);
  });

  it('cannot book equipment outside the workspace', async () => {
    await expect(bookFromPlan(['user-other'], 's', 'eq-ready')).rejects.toThrow(/not found/);
  });
});

describe('createServicePlan — validation', () => {
  const base = { equipmentId: 'eq-ready', startDate: '2026-10-01' };
  it('rejects non-whole, zero, negative or absurd intervals and a negative price', async () => {
    for (const bad of [
      { intervalMonths: 0 },
      { intervalMonths: -3 },
      { intervalMonths: 1.5 },
      { intervalMonths: 121 },
      { intervalHours: 0.25 },
      { intervalMonths: 12, price: -1 },
    ]) {
      await expect(createServicePlan(WS, 's', { ...base, ...bad })).rejects.toThrow(
        /whole number|zero or more|Set an interval/
      );
    }
  });
});

describe('createServicePlan — renewal', () => {
  it('renews a year on, or at the interval if that is longer, so it never renews before its first service', async () => {
    db.plans = [];
    const year = await createServicePlan(WS, 's', {
      equipmentId: 'eq-ready',
      intervalMonths: 6,
      startDate: '2026-10-01',
    });
    expect(year.renewalDate.toISOString().slice(0, 10)).toBe('2027-10-01');
    const long = await createServicePlan(WS, 's', {
      equipmentId: 'eq-ready',
      intervalMonths: 18,
      startDate: '2026-10-01',
    });
    expect(long.renewalDate.toISOString().slice(0, 10)).toBe('2028-04-01');
  });
});

describe('billableLabourHours — labour rounding', () => {
  it('rounds up to the next quarter hour with a 0.50 minimum', () => {
    expect(billableLabourHours(0)).toBe(0.5);
    expect(billableLabourHours(0.1)).toBe(0.5);
    expect(billableLabourHours(0.5)).toBe(0.5);
    expect(billableLabourHours(0.51)).toBe(0.75);
    expect(billableLabourHours(1)).toBe(1);
    expect(billableLabourHours(1.01)).toBe(1.25);
    expect(billableLabourHours(2.3)).toBe(2.5);
    // float noise must not bump an exact quarter, nor hide a real overrun
    expect(billableLabourHours(0.75)).toBe(0.75);
    expect(billableLabourHours(2.25)).toBe(2.25);
    expect(billableLabourHours(0.7 + 0.05)).toBe(0.75);
    expect(billableLabourHours(1.1)).toBe(1.25);
  });

  it('rejects negative hours', () => {
    expect(() => billableLabourHours(-1)).toThrow();
  });
});

describe('customer contact and invoicing — blocked', () => {
  it('invoice draft from a booking is refused and writes nothing', async () => {
    await expect(createInvoiceDraftFromBooking()).rejects.toBeInstanceOf(PlanInvoiceBlockedError);
    expect(db.invoiceWrites).toBe(0);
  });

  it('every reminder send path still refuses customer contact', async () => {
    await expect(sendWorkshopReminder(WS, 'r1')).rejects.toBeInstanceOf(
      WorkshopOutreachBlockedError
    );
    await expect(sendPendingWorkshopReminders(WS)).rejects.toBeInstanceOf(
      WorkshopOutreachBlockedError
    );
  });
});
