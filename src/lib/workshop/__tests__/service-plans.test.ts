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
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
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
    },
    workshopBooking: {
      findFirst: vi.fn(
        async ({ where }: { where: { equipmentId: string; status: { in: string[] } } }) =>
          db.bookings.find(
            (b) => b.equipmentId === where.equipmentId && where.status.in.includes(b.status)
          ) ?? null
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
  },
}));

vi.mock('@/lib/db/workshop-service', async (orig) => {
  const real = await orig<typeof import('@/lib/db/workshop-service')>();
  return {
    ...real,
    createWorkshopBooking: vi.fn(
      async (
        _ids: string[],
        owner: string,
        body: { equipment_id: string; service_template_id?: string }
      ) => {
        const b: Booking = {
          id: `bk-${db.bookings.length + 1}`,
          equipmentId: body.equipment_id,
          ownerUserId: owner,
          status: 'scheduled',
          serviceTemplateId: body.service_template_id ?? null,
          parts: [],
        };
        db.bookings.push(b);
        return { id: b.id };
      }
    ),
  };
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
  PlanInvoiceBlockedError,
} from '@/lib/workshop/service-plans';
import {
  createWorkshopBooking,
  sendPendingWorkshopReminders,
  sendWorkshopReminder,
} from '@/lib/db/workshop-service';
import { WorkshopOutreachBlockedError } from '@/lib/workshop/customer-outreach-gate';

const WS = ['user-a'];

beforeEach(() => {
  vi.mocked(createWorkshopBooking).mockClear();
  db.invoiceWrites = 0;
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
    expect(createWorkshopBooking).toHaveBeenCalledTimes(1);
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

describe('billableLabourHours — labour rounding', () => {
  it('rounds up to the next quarter hour with a 0.50 minimum', () => {
    expect(billableLabourHours(0)).toBe(0.5);
    expect(billableLabourHours(0.1)).toBe(0.5);
    expect(billableLabourHours(0.5)).toBe(0.5);
    expect(billableLabourHours(0.51)).toBe(0.75);
    expect(billableLabourHours(1)).toBe(1);
    expect(billableLabourHours(1.01)).toBe(1.25);
    expect(billableLabourHours(2.3)).toBe(2.5);
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
