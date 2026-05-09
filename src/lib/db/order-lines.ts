import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type RawLineInput = { product_id?: string; quantity?: number };

export async function resolveLinesFromPayload(
  items: unknown,
  productOwnerUserIds: string[],
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  const raw = Array.isArray(items) ? items : [];
  const ids = [
    ...new Set(
      raw
        .map((i: RawLineInput) => String(i.product_id ?? '').trim())
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
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }> = [];
  let subtotal = 0;

  for (const row of raw) {
    const pid = String((row as RawLineInput).product_id ?? '').trim();
    const qty = Math.max(0, Math.floor(Number((row as RawLineInput).quantity ?? 0)));
    if (!pid || qty <= 0) continue;
    const p = byId.get(pid);
    if (!p) {
      throw new Error(`Unknown or inactive product: ${pid}`);
    }
    const unit = Number(p.price ?? 0);
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
