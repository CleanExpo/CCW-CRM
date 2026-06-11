import { prisma } from '@/lib/db/prisma';
import type { CreateInvoiceItemRequest } from '@/types/invoices';

export async function nextInvoiceNumber(ownerUserId: string): Promise<string> {
  const year = new Date().getFullYear();
  const start = new Date(year, 0, 1);
  const count = await prisma.invoice.count({
    where: { createdAt: { gte: start }, ownerUserId },
  });
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

export type ResolvedInvoiceLine = {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
};

/**
 * Validates optional product IDs and builds persisted line rows with totals.
 */
export async function resolveInvoiceLinesFromPayload(
  items: CreateInvoiceItemRequest[],
  productOwnerUserIds: string[]
): Promise<ResolvedInvoiceLine[]> {
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: {
            id: { in: productIds },
            ownerUserId: { in: productOwnerUserIds },
            isActive: true,
          },
        })
      : [];
  const byId = new Map(products.map((p: { id: string }) => [p.id, p]));

  const lines: ResolvedInvoiceLine[] = [];

  for (const item of items) {
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('Each line must have quantity > 0');
    }
    const description = String(item.description ?? '').trim();
    if (!description) {
      throw new Error('Each line must have a description');
    }

    const rawPid = item.product_id?.trim() ?? '';
    if (rawPid) {
      const p = byId.get(rawPid);
      if (!p) {
        throw new Error(`Unknown or inactive product: ${rawPid}`);
      }
    }

    const unitPrice = Number(item.unit_price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error('Each line must have a valid unit price');
    }

    const lineSubtotal = qty * unitPrice;
    const taxRate = Number(item.tax_rate ?? 0);
    const computedTax =
      item.tax_amount !== undefined && item.tax_amount !== null
        ? Number(item.tax_amount)
        : lineSubtotal * (taxRate / 100);
    const taxAmount = Number.isFinite(computedTax) ? computedTax : 0;

    lines.push({
      productId: rawPid || null,
      description,
      quantity: qty,
      unitPrice,
      taxRate: Number.isFinite(taxRate) ? taxRate : 0,
      taxAmount,
      lineSubtotal,
      lineTotal: lineSubtotal + taxAmount,
    });
  }

  return lines;
}
