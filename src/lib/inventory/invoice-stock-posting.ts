import type { Prisma } from '@prisma/client';
import {
  applyWarehouseOnHandDelta,
  recordStockMovements,
  sourceAlreadyPosted,
  type StockMovementWrite,
} from '@/lib/inventory/stock-movement';

type InvoiceLineForStock = {
  quantity: number;
  productId: string | null;
  product: { id: string; sku: string } | null;
};

export async function postInvoiceSaleMovements(
  tx: Prisma.TransactionClient,
  input: {
    ownerUserId: string;
    invoiceId: string;
    branchName: string | null;
    items: InvoiceLineForStock[];
  }
): Promise<void> {
  if (await sourceAlreadyPosted(tx, 'invoice', input.invoiceId, 'sale')) return;
  const branch = input.branchName?.trim() || 'unassigned';
  const rows: StockMovementWrite[] = [];
  for (const item of input.items) {
    const product = item.product;
    if (!product?.sku || item.quantity === 0) continue;
    rows.push({
      ownerUserId: input.ownerUserId,
      productId: product.id,
      sku: product.sku,
      branchName: branch,
      quantity: -Math.abs(item.quantity),
      movementType: 'sale',
      sourceType: 'invoice',
      sourceId: input.invoiceId,
    });
    await applyWarehouseOnHandDelta(tx, {
      productId: product.id,
      ownerUserId: input.ownerUserId,
      branchName: branch,
      delta: -Math.abs(item.quantity),
    });
  }
  await recordStockMovements(tx, rows);
}

export async function reverseInvoiceSaleMovements(
  tx: Prisma.TransactionClient,
  input: {
    ownerUserId: string;
    invoiceId: string;
    branchName: string | null;
    items: InvoiceLineForStock[];
  }
): Promise<void> {
  if (!(await sourceAlreadyPosted(tx, 'invoice', input.invoiceId, 'sale'))) return;
  if (await sourceAlreadyPosted(tx, 'invoice', input.invoiceId, 'sale_reversal')) return;
  const branch = input.branchName?.trim() || 'unassigned';
  const rows: StockMovementWrite[] = [];
  for (const item of input.items) {
    const product = item.product;
    if (!product?.sku || item.quantity === 0) continue;
    rows.push({
      ownerUserId: input.ownerUserId,
      productId: product.id,
      sku: product.sku,
      branchName: branch,
      quantity: Math.abs(item.quantity),
      movementType: 'sale_reversal',
      sourceType: 'invoice',
      sourceId: input.invoiceId,
    });
    await applyWarehouseOnHandDelta(tx, {
      productId: product.id,
      ownerUserId: input.ownerUserId,
      branchName: branch,
      delta: Math.abs(item.quantity),
    });
  }
  await recordStockMovements(tx, rows);
}
