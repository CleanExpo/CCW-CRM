import type { Prisma } from '@prisma/client';
import {
  ensureProductLocationStockRows,
  isWarehouseLocation,
  normalizeWarehouseLocation,
  syncProductStockTotal,
} from '@/lib/db/inventory-location-transfer';

export type StockMovementType =
  | 'adjustment'
  | 'transfer_out'
  | 'transfer_in'
  | 'receipt'
  | 'sale'
  | 'sale_reversal';

export type StockMovementWrite = {
  ownerUserId: string;
  productId?: string | null;
  sku: string;
  branchName: string;
  quantity: number;
  movementType: StockMovementType;
  sourceType: string;
  sourceId: string;
  notes?: string | null;
};

export function parseSaleBranch(raw: unknown): string | null {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!value) return null;
  if (value === 'brisbane' || value === 'sydney' || value === 'melbourne') return value;
  return value.slice(0, 80);
}

export function sanitizeMovementRows(rows: StockMovementWrite[]): StockMovementWrite[] {
  return rows.filter((row) => {
    const sku = row.sku.trim();
    const branch = row.branchName.trim();
    return sku.length > 0 && branch.length > 0 && Number.isFinite(row.quantity) && row.quantity !== 0;
  });
}

export async function recordStockMovements(
  tx: Prisma.TransactionClient,
  rows: StockMovementWrite[]
): Promise<number> {
  const data = sanitizeMovementRows(rows);
  if (data.length === 0) return 0;
  const result = await tx.stockMovement.createMany({
    data: data.map((row) => ({
      ownerUserId: row.ownerUserId,
      productId: row.productId ?? null,
      sku: row.sku.trim(),
      branchName: row.branchName.trim(),
      quantity: Math.trunc(row.quantity),
      movementType: row.movementType,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      notes: row.notes ?? null,
    })),
  });
  return result.count;
}

export async function sourceAlreadyPosted(
  tx: Prisma.TransactionClient,
  sourceType: string,
  sourceId: string,
  movementType: StockMovementType
): Promise<boolean> {
  const n = await tx.stockMovement.count({
    where: { sourceType, sourceId, movementType },
  });
  return n > 0;
}

/** Change on-hand at a named warehouse. No-op when branch is not brisbane/sydney/melbourne. */
export async function applyWarehouseOnHandDelta(
  tx: Prisma.TransactionClient,
  input: {
    productId: string;
    ownerUserId: string;
    branchName: string;
    delta: number;
  }
): Promise<void> {
  if (!isWarehouseLocation(input.branchName) || input.delta === 0) return;
  const location = normalizeWarehouseLocation(input.branchName);
  const product = await tx.product.findFirst({
    where: { id: input.productId, ownerUserId: input.ownerUserId },
    select: { id: true, stock: true, warehouseLocation: true },
  });
  if (!product) return;
  await ensureProductLocationStockRows(tx, product);
  await tx.productLocationStock.update({
    where: { productId_location: { productId: product.id, location } },
    data: { quantity: { increment: input.delta } },
  });
  await syncProductStockTotal(tx, product.id);
}
