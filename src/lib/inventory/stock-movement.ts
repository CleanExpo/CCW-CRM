import type { Prisma } from '@prisma/client';

export type StockMovementType =
  | 'adjustment'
  | 'transfer_out'
  | 'transfer_in'
  | 'receipt'
  | 'sale';

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

export async function recordStockMovements(
  tx: Prisma.TransactionClient,
  rows: StockMovementWrite[]
): Promise<void> {
  if (rows.length === 0) return;
  await tx.stockMovement.createMany({
    data: rows.map((row) => ({
      ownerUserId: row.ownerUserId,
      productId: row.productId ?? null,
      sku: row.sku,
      branchName: row.branchName,
      quantity: row.quantity,
      movementType: row.movementType,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      notes: row.notes ?? null,
    })),
  });
}

export function parseSaleBranch(raw: unknown): string | null {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!value) return null;
  if (value === 'brisbane' || value === 'sydney' || value === 'melbourne') return value;
  return value.slice(0, 80);
}
