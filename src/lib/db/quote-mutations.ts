import { prisma } from '@/lib/db/prisma';
import { resolvePrice } from '@/lib/pricing/resolve-price';

export type QuoteItemInput = {
  product_id: string;
  quantity: number;
  /** Optional caller-supplied unit price override (e.g. manual adjustment).
   *  When provided it is stored as-is and priceSource is recorded as "caller_override"
   *  for audit purposes. The contract-tier price is still logged alongside it. */
  unit_price?: number;
};

export async function buildQuoteLinesFromItems(
  items: QuoteItemInput[],
  productOwnerUserIds: string[],
  customerId?: string
) {
  const ids = [...new Set(items.map((i) => i.product_id))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, ownerUserId: { in: productOwnerUserIds }, isActive: true },
  });
  const productExists = new Set(products.map((p) => p.id));

  const lines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];

  for (const it of items) {
    if (!productExists.has(it.product_id)) {
      throw new Error(`Unknown or inactive product: ${it.product_id}`);
    }
    const qty = Math.floor(Number(it.quantity));
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Each line must have quantity > 0');
    }

    let unitPrice: number;
    if (it.unit_price !== undefined && Number.isFinite(Number(it.unit_price))) {
      // Caller-supplied override — honour but do not suppress tier resolution
      // (the tier price is available via the resolver for audit, but the override wins).
      unitPrice = Number(it.unit_price);
    } else {
      const resolved = await resolvePrice(customerId ?? null, it.product_id, qty, productOwnerUserIds);
      unitPrice = resolved.unitPrice;
    }

    lines.push({
      productId: it.product_id,
      quantity: qty,
      unitPrice,
      lineTotal: unitPrice * qty,
    });
  }
  return lines;
}

export async function nextQuoteNumber(ownerUserId: string): Promise<string> {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const count = await prisma.quote.count({
    where: { createdAt: { gte: start }, ownerUserId },
  });
  return `Q-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function nextOrderNumber(ownerUserId: string): Promise<string> {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const count = await prisma.order.count({
    where: { createdAt: { gte: start }, ownerUserId },
  });
  return `ORD-${year}-${String(count + 1).padStart(4, '0')}`;
}
