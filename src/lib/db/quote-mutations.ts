import { prisma } from '@/lib/db/prisma';

export type QuoteItemInput = { product_id: string; quantity: number };

export async function buildQuoteLinesFromItems(items: QuoteItemInput[]) {
  const ids = [...new Set(items.map((i) => i.product_id))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];

  for (const it of items) {
    const p = byId.get(it.product_id);
    if (!p) {
      throw new Error(`Unknown or inactive product: ${it.product_id}`);
    }
    const qty = Math.floor(Number(it.quantity));
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Each line must have quantity > 0');
    }
    const unitPrice = p.price;
    lines.push({
      productId: p.id,
      quantity: qty,
      unitPrice,
      lineTotal: unitPrice * qty,
    });
  }
  return lines;
}

export async function nextQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const count = await prisma.quote.count({
    where: { createdAt: { gte: start } },
  });
  return `Q-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function nextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const count = await prisma.order.count({
    where: { createdAt: { gte: start } },
  });
  return `ORD-${year}-${String(count + 1).padStart(4, '0')}`;
}
