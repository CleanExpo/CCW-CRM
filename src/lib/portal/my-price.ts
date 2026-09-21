/**
 * UNI-2747: "my price" and "order again" for trade customers in the portal.
 *
 * Customer-facing, so it is shut by default. It opens only where
 * PORTAL_ORDERING_ENABLED=true is set (staging), and must stay shut in
 * production until Toby signs the Phase 1 stock totals.
 *
 * Every price comes from resolvePrice, so the portal can never show a price
 * the rest of Optix would not charge. Orders land as drafts for staff to
 * confirm; nothing is fulfilled automatically.
 */
import { prisma } from '@/lib/db/prisma';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { resolvePrice, type PriceSource } from '@/lib/pricing/resolve-price';
import { generateOrderNumber } from '@/lib/db/order-lines';

export const PORTAL_ORDERING_BLOCKED_CODE = 'PORTAL_ORDERING_BLOCKED';
export const PORTAL_ORDERING_BLOCKED_DETAIL =
  'Online ordering is not open yet. It opens once the Phase 1 stock totals are signed.';

export function portalOrderingEnabled(): boolean {
  return process.env.PORTAL_ORDERING_ENABLED === 'true';
}

export class PortalOrderError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const GST = 0.1;

async function customerScope(customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, isActive: true },
    select: { id: true, ownerUserId: true },
  });
  if (!customer) throw new PortalOrderError('Customer not found', 404);
  return { customer, workspaceUserIds: await getWorkspaceMemberUserIds(customer.ownerUserId) };
}

export type MyPriceRow = {
  product_id: string;
  sku: string;
  name: string;
  category: string | null;
  unit_price: number;
  price_source: PriceSource;
};

/** Active products in the customer's supplier workspace, each at this customer's price. */
export async function listMyPrices(
  customerId: string,
  opts: { search?: string; page: number; pageSize: number }
): Promise<{ items: MyPriceRow[]; total: number }> {
  const { workspaceUserIds } = await customerScope(customerId);
  const where = {
    ownerUserId: { in: workspaceUserIds },
    isActive: true,
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: 'insensitive' as const } },
            { sku: { contains: opts.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: { id: true, sku: true, name: true, category: true },
      orderBy: { name: 'asc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
    }),
    prisma.product.count({ where }),
  ]);
  const items: MyPriceRow[] = [];
  for (const p of products) {
    const r = await resolvePrice(customerId, p.id, 1, workspaceUserIds);
    items.push({
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      unit_price: r.unitPrice,
      price_source: r.source,
    });
  }
  return { items, total };
}

async function createDraftOrder(
  customer: { id: string; ownerUserId: string },
  workspaceUserIds: string[],
  wanted: { productId: string; quantity: number; unitPrice?: number }[]
) {
  const active = await prisma.product.findMany({
    where: {
      id: { in: wanted.map((w) => w.productId) },
      ownerUserId: { in: workspaceUserIds },
      isActive: true,
    },
    select: { id: true },
  });
  const activeIds = new Set(active.map((p) => p.id));
  const unavailable = wanted.filter((w) => !activeIds.has(w.productId)).map((w) => w.productId);
  const lines = [];
  let subtotal = 0;
  for (const w of wanted.filter((x) => activeIds.has(x.productId))) {
    const unitPrice =
      w.unitPrice ??
      (await resolvePrice(customer.id, w.productId, w.quantity, workspaceUserIds)).unitPrice;
    const lineTotal = Math.round(unitPrice * w.quantity * 100) / 100;
    subtotal += lineTotal;
    lines.push({ productId: w.productId, quantity: w.quantity, unitPrice, lineTotal });
  }
  if (lines.length === 0)
    throw new PortalOrderError('None of these products can be ordered now', 409);
  const order = await prisma.order.create({
    data: {
      ownerUserId: customer.ownerUserId,
      customerId: customer.id,
      orderNumber: generateOrderNumber(),
      status: 'draft',
      total: Math.round(subtotal * (1 + GST) * 100) / 100,
      lineItems: { create: lines },
    },
    include: { lineItems: true },
  });
  return { order, unavailable };
}

/**
 * Repeats a past order (or chosen lines of it) as a new draft order at today's
 * price. Refuses an order that belongs to another customer.
 */
export async function orderAgain(customerId: string, orderId: string, lineIds?: string[]) {
  const { customer, workspaceUserIds } = await customerScope(customerId);
  const past = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: { lineItems: true },
  });
  if (!past) throw new PortalOrderError('Order not found', 404);
  const chosen = lineIds?.length
    ? past.lineItems.filter((l) => lineIds.includes(l.id))
    : past.lineItems;
  if (chosen.length === 0) throw new PortalOrderError('No lines selected', 400);
  return createDraftOrder(
    customer,
    workspaceUserIds,
    chosen.map((l) => ({ productId: l.productId, quantity: l.quantity }))
  );
}

/** A staff quote opened by its own customer, priced the way orderQuote will charge it. */
export async function getQuoteCart(customerId: string, quoteId: string) {
  const { workspaceUserIds } = await customerScope(customerId);
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, customerId },
    include: { lineItems: { include: { product: { select: { name: true, sku: true } } } } },
  });
  if (!quote) throw new PortalOrderError('Quote not found', 404);
  const lines = [];
  for (const l of quote.lineItems) {
    const r = await resolvePrice(customerId, l.productId, l.quantity, workspaceUserIds);
    lines.push({
      product_id: l.productId,
      sku: l.product.sku,
      name: l.product.name,
      quantity: l.quantity,
      quoted_unit_price: l.unitPrice,
      unit_price: quoteStillValid(quote.validUntil) ? l.unitPrice : r.unitPrice,
    });
  }
  return {
    quote_id: quote.id,
    quote_number: quote.quoteNumber,
    valid_until: quote.validUntil,
    quoted_prices_honoured: quoteStillValid(quote.validUntil),
    lines,
  };
}

/**
 * Turns the customer's own quote into a draft order: at the quoted prices while
 * the quote is valid, at today's prices once it has expired.
 */
export async function orderQuote(customerId: string, quoteId: string) {
  const { customer, workspaceUserIds } = await customerScope(customerId);
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, customerId },
    include: { lineItems: true },
  });
  if (!quote) throw new PortalOrderError('Quote not found', 404);
  const honoured = quoteStillValid(quote.validUntil);
  return createDraftOrder(
    customer,
    workspaceUserIds,
    quote.lineItems.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      ...(honoured ? { unitPrice: l.unitPrice } : {}),
    }))
  );
}

export function quoteStillValid(validUntil: Date | null, now = new Date()): boolean {
  return validUntil !== null && validUntil.getTime() >= now.getTime();
}
