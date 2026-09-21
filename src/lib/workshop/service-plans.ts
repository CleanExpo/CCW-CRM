/**
 * UNI-2750: workshop service plans.
 *
 * Pilot rules (docs/CCW-WORKSHOP-PILOT-SCOPE.md): nothing here contacts a
 * customer, bookings are staff-diary only, and labour follows Toby's existing
 * clock (docs/CCW-WORKSHOP-TIMESHEET-INSTRUCTIONS.md) rather than a new one.
 */
import { addMonths } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import { listFitsForMachine } from '@/lib/fitment/fitment-service';

export class ServicePlanError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
  }
}

// ─── Labour: Toby's rule ─────────────────────────────────────────────────────

/** Hours as .25 steps, rounded up, minimum charge .50 (timesheet rule 1). */
export function billableLabourHours(actualHours: number): number {
  if (!Number.isFinite(actualHours) || actualHours < 0) {
    throw new ServicePlanError('Hours must be zero or more');
  }
  const quarters = Math.ceil(actualHours * 4 - 1e-9);
  return Math.max(0.5, quarters / 4);
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export async function createServicePlan(
  workspaceUserIds: string[],
  actorUserId: string,
  input: {
    equipmentId: string;
    serviceTemplateId?: string | null;
    intervalMonths?: number | null;
    intervalHours?: number | null;
    price?: number | null;
    includes?: string;
    startDate: string;
  }
) {
  if (!input.intervalMonths && !input.intervalHours) {
    throw new ServicePlanError('Set an interval in months, hours, or both');
  }
  const wholeInRange = (v: number | null | undefined, max: number) =>
    v == null || (Number.isInteger(v) && v >= 1 && v <= max);
  if (!wholeInRange(input.intervalMonths, 120)) {
    throw new ServicePlanError('interval_months must be a whole number from 1 to 120');
  }
  if (!wholeInRange(input.intervalHours, 100_000)) {
    throw new ServicePlanError('interval_hours must be a whole number from 1 to 100000');
  }
  if (input.price != null && !(Number.isFinite(input.price) && input.price >= 0)) {
    throw new ServicePlanError('price must be zero or more');
  }
  const start = new Date(`${input.startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) throw new ServicePlanError('start_date must be YYYY-MM-DD');
  const equipment = await prisma.workshopEquipment.findFirst({
    where: { id: input.equipmentId, ownerUserId: { in: workspaceUserIds } },
    select: { id: true },
  });
  if (!equipment) throw new ServicePlanError('Equipment not found', 404);
  if (input.serviceTemplateId) {
    const t = await prisma.workshopServiceTemplate.findFirst({
      where: { id: input.serviceTemplateId, ownerUserId: { in: workspaceUserIds } },
      select: { id: true },
    });
    if (!t) throw new ServicePlanError('Template not found', 404);
  }
  const existing = await prisma.workshopServicePlan.findFirst({
    where: { equipmentId: input.equipmentId, status: 'active' },
    select: { id: true },
  });
  if (existing) throw new ServicePlanError('This machine already has an active plan', 409);
  // The partial unique index (one active plan per machine) closes the gap between
  // the check above and this insert; a racing second insert lands here as P2002.
  return prisma.workshopServicePlan.create({
    data: {
      ownerUserId: actorUserId,
      equipmentId: input.equipmentId,
      serviceTemplateId: input.serviceTemplateId ?? null,
      intervalMonths: input.intervalMonths ?? null,
      intervalHours: input.intervalHours ?? null,
      price: input.price ?? null,
      includes: input.includes ?? '',
      startDate: start,
      renewalDate: addMonths(start, 12),
      createdBy: actorUserId,
    },
  });
}

/** Active plans, soonest renewal first. `withinDays` limits to renewals due by then. */
export async function listServicePlans(
  workspaceUserIds: string[],
  opts: { withinDays?: number; now?: Date } = {}
) {
  const now = opts.now ?? new Date();
  return prisma.workshopServicePlan.findMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      status: 'active',
      ...(opts.withinDays !== undefined
        ? { renewalDate: { lte: new Date(now.getTime() + opts.withinDays * 86_400_000) } }
        : {}),
    },
    include: { equipment: { include: { customer: { select: { companyName: true } } } } },
    orderBy: { renewalDate: 'asc' },
  });
}

export async function cancelServicePlan(workspaceUserIds: string[], id: string) {
  const res = await prisma.workshopServicePlan.updateMany({
    where: { id, ownerUserId: { in: workspaceUserIds }, status: 'active' },
    data: { status: 'cancelled' },
  });
  return res.count > 0;
}

// ─── Recall → booking with kit ───────────────────────────────────────────────

const OPEN_BOOKING = ['scheduled', 'confirmed', 'in_progress'];

/**
 * Turns a machine that recall review marked "ready to book" into one staff
 * booking: the plan's template, and a parts kit of the template's items plus
 * confirmed parts and consumables from the parts map. Calling it again while
 * that booking is open returns the same booking. No customer is contacted.
 */
export async function bookFromPlan(
  workspaceUserIds: string[],
  actorUserId: string,
  equipmentId: string,
  scheduledDate?: string
) {
  const equipment = await prisma.workshopEquipment.findFirst({
    where: { id: equipmentId, ownerUserId: { in: workspaceUserIds } },
    include: { recallCase: true },
  });
  if (!equipment) throw new ServicePlanError('Equipment not found', 404);
  if (equipment.recallCase?.status !== 'ready_to_book') {
    throw new ServicePlanError('Recall review must mark this machine ready to book first', 409);
  }
  const plan = await prisma.workshopServicePlan.findFirst({
    where: { equipmentId, ownerUserId: { in: workspaceUserIds }, status: 'active' },
  });
  if (!plan) throw new ServicePlanError('This machine has no active service plan', 409);

  const kit = new Map<string, { productId: string; quantity: number; source: string }>();
  if (plan.serviceTemplateId) {
    const items = await prisma.workshopServiceTemplateItem.findMany({
      where: { templateId: plan.serviceTemplateId },
      select: { productId: true, quantity: true },
    });
    for (const i of items)
      kit.set(i.productId, { productId: i.productId, quantity: i.quantity, source: 'template' });
  }
  if (equipment.productId) {
    const fits = await listFitsForMachine(workspaceUserIds, equipment.productId, 'customer');
    for (const f of fits) {
      if (f.kind === 'accessory' || kit.has(f.fitProductId)) continue;
      kit.set(f.fitProductId, { productId: f.fitProductId, quantity: 1, source: 'fitment' });
    }
  }
  const parts = [...kit.values()];
  const when = new Date(
    scheduledDate ?? (equipment.nextServiceDate ?? new Date()).toISOString().slice(0, 10)
  );
  if (Number.isNaN(when.getTime())) throw new ServicePlanError('scheduled_date must be a date');

  // Check-then-create under a per-machine transaction lock, so two clicks at the
  // same moment cannot both see "no open booking" and make two.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`workshop-booking:${equipmentId}`}))`;
    const open = await tx.workshopBooking.findFirst({
      where: { equipmentId, ownerUserId: { in: workspaceUserIds }, status: { in: OPEN_BOOKING } },
      include: { parts: true },
    });
    if (open) return { created: false, bookingId: open.id, parts: open.parts };
    const n = await tx.workshopBooking.count({ where: { ownerUserId: actorUserId } });
    const booking = await tx.workshopBooking.create({
      data: {
        ownerUserId: actorUserId,
        bookingNumber: `WB-${String(n + 1).padStart(5, '0')}`,
        equipmentId,
        serviceTemplateId: plan.serviceTemplateId ?? null,
        location: equipment.location,
        scheduledDate: when,
      },
    });
    if (parts.length > 0) {
      await tx.workshopBookingPart.createMany({
        data: parts.map((p) => ({ ...p, bookingId: booking.id })),
        skipDuplicates: true,
      });
    }
    return { created: true, bookingId: booking.id, parts };
  });
}

// ─── Booking → invoice ───────────────────────────────────────────────────────

export const PLAN_INVOICE_BLOCKED_CODE = 'PLAN_INVOICE_BLOCKED';
export const PLAN_INVOICE_BLOCKED_DETAIL =
  'Invoice drafts from bookings are blocked: invoice line quantity is a whole number, so ' +
  'XLABOUR hours such as 1.25 cannot be stored without misstating them. Enter XLABOUR in Cin7 ' +
  'as today until invoice line quantity can hold decimals (a decision for a human).';

export class PlanInvoiceBlockedError extends ServicePlanError {
  readonly code = PLAN_INVOICE_BLOCKED_CODE;
  constructor() {
    super(PLAN_INVOICE_BLOCKED_DETAIL, 409);
  }
}

/** What the invoice would carry: rounded XLABOUR hours and the kit. Read only. */
export async function previewBookingInvoice(workspaceUserIds: string[], bookingId: string) {
  const booking = await prisma.workshopBooking.findFirst({
    where: { id: bookingId, ownerUserId: { in: workspaceUserIds } },
    include: { parts: { include: { product: { select: { name: true, sku: true } } } } },
  });
  if (!booking) throw new ServicePlanError('Booking not found', 404);
  if (booking.status !== 'completed' || booking.actualHours == null) {
    throw new ServicePlanError('Complete the booking with actual hours first', 409);
  }
  return {
    booking_id: booking.id,
    actual_hours: booking.actualHours,
    xlabour_hours: billableLabourHours(booking.actualHours),
    parts: booking.parts.map((p) => ({
      sku: p.product.sku,
      name: p.product.name,
      quantity: p.quantity,
    })),
  };
}

/** Always refuses for now, before any read or write. See PLAN_INVOICE_BLOCKED_DETAIL. */
export async function createInvoiceDraftFromBooking(): Promise<never> {
  throw new PlanInvoiceBlockedError();
}
