/**
 * UNI-2749: database side of the reorder radar. All the rules live in
 * cadence.ts; this file only loads purchase lines and names things.
 */
import { prisma } from '@/lib/db/prisma';
import { listFitsForMachine } from '@/lib/fitment/fitment-service';
import {
  buildRadar,
  dailyDemandByProduct,
  NON_SALE_STATUSES,
  type CadenceRow,
  type PurchaseLine,
  type QuietRow,
} from '@/lib/reorder-radar/cadence';

export const CALL_OUTCOMES = {
  ordered: 'Ordered',
  call_back: 'Call back later',
  not_needed: 'Not needed yet',
  no_answer: 'No answer',
  lost: 'Buying elsewhere',
} as const;
export type CallOutcome = keyof typeof CALL_OUTCOMES;

export function isCallOutcome(v: unknown): v is CallOutcome {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CALL_OUTCOMES, v);
}

/** Posted invoice lines up to and including `asOf` (YYYY-MM-DD). */
export async function loadPurchaseLines(
  workspaceUserIds: string[],
  asOf: string
): Promise<PurchaseLine[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      ownerUserId: { in: workspaceUserIds },
      invoiceDate: { lte: new Date(`${asOf}T00:00:00Z`) },
      status: { notIn: [...NON_SALE_STATUSES] },
    },
    select: {
      customerId: true,
      invoiceDate: true,
      items: { select: { productId: true, quantity: true } },
    },
  });
  return invoices.flatMap((inv) =>
    inv.items
      .filter((i): i is { productId: string; quantity: number } => Boolean(i.productId))
      .map((i) => ({
        customerId: inv.customerId,
        productId: i.productId,
        date: inv.invoiceDate.toISOString().slice(0, 10),
        quantity: i.quantity,
      }))
  );
}

type Named = { id: string; name: string; sku: string };

export async function getReorderRadar(workspaceUserIds: string[], asOf: string) {
  const radar = buildRadar(await loadPurchaseLines(workspaceUserIds, asOf), asOf);

  const listed = [...radar.due, ...radar.overdue];
  const customerIds = [
    ...new Set([...listed.map((c) => c.customerId), ...radar.goneQuiet.map((q) => q.customerId)]),
  ];
  const productIds = [...new Set(listed.map((c) => c.productId))];

  const [customers, products, equipment] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: customerIds }, ownerUserId: { in: workspaceUserIds } },
      select: { id: true, companyName: true, contactName: true, phone: true },
    }),
    prisma.product.findMany({
      where: { id: { in: productIds }, ownerUserId: { in: workspaceUserIds } },
      select: { id: true, name: true, sku: true },
    }),
    prisma.workshopEquipment.findMany({
      where: {
        customerId: { in: customerIds },
        ownerUserId: { in: workspaceUserIds },
        productId: { not: null },
        status: { not: 'retired' },
      },
      select: { customerId: true, productId: true, make: true, model: true },
    }),
  ]);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const productById = new Map<string, Named>(products.map((p) => [p.id, p]));

  // What each customer's machines take. Confirmed map rows only: staff offer these to customers.
  const fitsByMachine = new Map<string, Named[]>();
  for (const machineId of new Set(equipment.map((e) => e.productId as string))) {
    const fits = await listFitsForMachine(workspaceUserIds, machineId, 'customer');
    fitsByMachine.set(
      machineId,
      fits.map((f) => ({ id: f.fitProduct.id, name: f.fitProduct.name, sku: f.fitProduct.sku }))
    );
  }
  const machineNeeds = (customerId: string) =>
    equipment
      .filter((e) => e.customerId === customerId)
      .map((e) => ({
        machine: `${e.make} ${e.model}`.trim(),
        products: fitsByMachine.get(e.productId as string) ?? [],
      }))
      .filter((m) => m.products.length > 0);

  const customerApi = (id: string) => {
    const c = customerById.get(id);
    return {
      id,
      company_name: c?.companyName ?? 'Unknown customer',
      contact_name: c?.contactName ?? null,
      phone: c?.phone ?? null,
    };
  };
  const cadenceApi = (c: CadenceRow) => ({
    customer: customerApi(c.customerId),
    product: productById.get(c.productId) ?? { id: c.productId, name: 'Unknown product', sku: '' },
    purchases: c.purchases,
    cadence_days: c.cadenceDays,
    avg_quantity: Math.round(c.avgQuantity * 100) / 100,
    last_purchase: c.lastDate,
    expected: c.expectedDate,
    days_late: c.daysLate,
    machine_needs: machineNeeds(c.customerId),
  });
  const quietApi = (q: QuietRow) => ({
    customer: customerApi(q.customerId),
    purchases: q.purchases,
    cadence_days: q.cadenceDays,
    last_purchase: q.lastDate,
    days_silent: q.daysSilent,
    machine_needs: machineNeeds(q.customerId),
  });

  return {
    as_of: radar.asOf,
    due: radar.due.map(cadenceApi),
    overdue: radar.overdue.map(cadenceApi),
    gone_quiet: radar.goneQuiet.map(quietApi),
  };
}

export class RadarInputError extends Error {}

/** Records what happened on a radar call as a completed CRM call activity. */
export async function logCallOutcome(
  workspaceUserIds: string[],
  actorUserId: string,
  input: { customerId: string; outcome: string; productId?: string | null; notes?: string | null }
) {
  if (!isCallOutcome(input.outcome)) throw new RadarInputError('Invalid outcome');
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, ownerUserId: { in: workspaceUserIds } },
    select: { id: true },
  });
  if (!customer) return null;
  let productLabel = '';
  if (input.productId) {
    const p = await prisma.product.findFirst({
      where: { id: input.productId, ownerUserId: { in: workspaceUserIds } },
      select: { name: true },
    });
    if (!p) throw new RadarInputError('Product not found');
    productLabel = ` (${p.name})`;
  }
  const now = new Date();
  return prisma.crmActivity.create({
    data: {
      ownerUserId: actorUserId,
      activityType: 'call',
      subject: `Reorder call: ${CALL_OUTCOMES[input.outcome]}${productLabel}`,
      description: input.notes?.trim() || null,
      customerId: customer.id,
      completedAt: now,
      createdBy: actorUserId,
    },
  });
}

const LEAD_TIME_DAYS = 14;
const SAFETY_DAYS = 7;

/**
 * Demand forecast in the shape the inventory forecast screen already reads.
 * Demand comes only from trusted customer cadences, so a product nobody buys
 * on a rhythm shows zero demand rather than a guess.
 */
export async function getInventoryForecast(
  workspaceUserIds: string[],
  asOf: string,
  opts: { productId?: string | null; forecastDays: number }
) {
  const radar = buildRadar(await loadPurchaseLines(workspaceUserIds, asOf), asOf);
  const demand = dailyDemandByProduct(radar.cadences);
  const pairs = new Map<string, number>();
  for (const c of radar.cadences) pairs.set(c.productId, (pairs.get(c.productId) ?? 0) + 1);

  const ids = opts.productId ? [opts.productId] : [...demand.keys()];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, ownerUserId: { in: workspaceUserIds } },
    select: { id: true, name: true, sku: true, stock: true, price: true },
  });

  const today = Date.parse(`${asOf}T00:00:00Z`);
  const forecasts = products.map((p) => {
    const daily = demand.get(p.id) ?? 0;
    const daysLeft = daily > 0 ? Math.floor(p.stock / daily) : null;
    const safety = Math.ceil(daily * SAFETY_DAYS);
    const reorderPoint = Math.ceil(daily * LEAD_TIME_DAYS) + safety;
    const needs = daily > 0 && p.stock <= reorderPoint;
    const urgency: 'critical' | 'high' | 'medium' | 'low' =
      daysLeft === null
        ? 'low'
        : daysLeft <= 7
          ? 'critical'
          : daysLeft <= 14
            ? 'high'
            : daysLeft <= 30
              ? 'medium'
              : 'low';
    const cadencePairs = pairs.get(p.id) ?? 0;
    return {
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      current_stock: p.stock,
      sales_velocity: {
        avg_daily_sales: Math.round(daily * 1000) / 1000,
        total_sold: Math.round(daily * opts.forecastDays),
        order_count: cadencePairs,
        days_of_data: opts.forecastDays,
      },
      forecast: {
        days_until_depletion: daysLeft,
        depletion_date:
          daysLeft === null
            ? null
            : new Date(today + daysLeft * 86_400_000).toISOString().slice(0, 10),
        reorder_point: reorderPoint,
        safety_stock: safety,
      },
      recommendation: {
        needs_reorder: needs,
        urgency,
        recommended_order_qty: needs
          ? Math.max(Math.ceil(daily * opts.forecastDays) + reorderPoint - p.stock, 0)
          : 0,
        estimated_cost: null,
      },
      seasonal_pattern: null,
      // More customers buying on a rhythm = more trust in the number. Five or more = full.
      confidence: Math.min(cadencePairs / 5, 1),
    };
  });
  forecasts.sort(
    (a, b) =>
      (a.forecast.days_until_depletion ?? Infinity) - (b.forecast.days_until_depletion ?? Infinity)
  );
  const reorder = forecasts.filter((f) => f.recommendation.needs_reorder);
  const confidence = forecasts.length
    ? Math.round((forecasts.reduce((s, f) => s + f.confidence, 0) / forecasts.length) * 100) / 100
    : 0;
  return {
    forecasts,
    reorder_recommendations: reorder,
    total_products_analyzed: forecasts.length,
    confidence,
    as_of: asOf,
    method: 'Customer reorder cadence from posted invoices (median gap, 3+ purchases)',
  };
}
