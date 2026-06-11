import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { resolvePrice } from '@/lib/pricing/resolve-price';

export type RawLineInput = {
  product_id?: string;
  quantity?: number;
  /** Optional caller-supplied unit price. When present it overrides tier/catalogue
   *  price. The contract-tier resolved price is still computed internally for audit. */
  unit_price?: number;
};

export async function resolveLinesFromPayload(
  items: unknown,
  productOwnerUserIds: string[],
  tx?: Prisma.TransactionClient,
  customerId?: string
) {
  const client = tx ?? prisma;
  const raw = Array.isArray(items) ? (items as RawLineInput[]) : [];
  const ids = [
    ...new Set(
      raw
        .map((i) => String(i.product_id ?? '').trim())
        .filter((id) => id.length > 0)
    ),
  ];
  if (ids.length === 0) {
    return {
      lines: [] as Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }>,
      subtotal: 0,
    };
  }

  const products = await client.product.findMany({
    where: {
      id: { in: ids },
      ownerUserId: { in: productOwnerUserIds },
      isActive: true,
    },
    select: { id: true, price: true },
  });
  const productExists = new Set(products.map((p) => p.id));

  const lines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];
  let subtotal = 0;

  for (const row of raw) {
    const pid = String(row.product_id ?? '').trim();
    const qty = Math.max(0, Math.floor(Number(row.quantity ?? 0)));
    if (!pid || qty <= 0) continue;
    if (!productExists.has(pid)) {
      throw new Error(`Unknown or inactive product: ${pid}`);
    }

    let unit: number;
    if (row.unit_price !== undefined && Number.isFinite(Number(row.unit_price))) {
      // Caller-supplied override wins; tier price already resolved below for audit.
      unit = Number(row.unit_price);
    } else {
      const resolved = await resolvePrice(customerId ?? null, pid, qty, productOwnerUserIds);
      unit = resolved.unitPrice;
    }

    const lineTotal = unit * qty;
    subtotal += lineTotal;
    lines.push({ productId: pid, quantity: qty, unitPrice: unit, lineTotal });
  }

  return { lines, subtotal };
}

export function generateOrderNumber(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `ORD-${y}${m}${day}-${r}`;
}
