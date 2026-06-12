import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { syncProductStockTotal } from './inventory-location-transfer';

export interface CancelTransferOptions {
  /** Transfer id to cancel */
  id: string;
  /** All workspace member user ids for org scoping */
  workspaceUserIds: string[];
}

export type CancelTransferResult =
  | { ok: true; transfer: CancelledTransferRow }
  | { ok: false; status: 404 | 409; detail: string };

export interface CancelledTransferRow {
  id: string;
  status: string;
  productId: string;
  productName: string;
  productSku: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  reason: string | null;
  notes: string | null;
  updatedAt: Date;
}

/**
 * Cancel a pending or in_transit stock transfer.
 *
 * Rollback rules:
 *  - completed  → 409 (stock already moved; create a reverse transfer instead)
 *  - cancelled  → 409 (idempotency guard)
 *  - pending    → set status = 'cancelled'; NO stock adjustment (stock not yet moved)
 *  - in_transit → restore quantity to fromLocation, decrement toLocation, set status = 'cancelled'
 *
 * Org scoping is enforced by filtering on product.ownerUserId ∈ workspaceUserIds.
 */
export async function cancelTransfer(
  opts: CancelTransferOptions,
): Promise<CancelTransferResult> {
  const { id, workspaceUserIds } = opts;

  const transfer = await prisma.stockTransfer.findFirst({
    where: {
      id,
      product: { ownerUserId: { in: workspaceUserIds } },
    },
    select: {
      id: true,
      status: true,
      productId: true,
      fromLocation: true,
      toLocation: true,
      quantity: true,
    },
  });

  if (!transfer) {
    return { ok: false, status: 404, detail: 'Transfer not found' };
  }

  if (transfer.status === 'completed') {
    return {
      ok: false,
      status: 409,
      detail:
        'Cannot cancel a completed transfer. Stock has already been moved. Create a reverse transfer if needed.',
    };
  }

  if (transfer.status === 'cancelled') {
    return { ok: false, status: 409, detail: 'Transfer is already cancelled.' };
  }

  const cancelled = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (transfer.status === 'in_transit') {
      // Stock was moved when the transfer went in_transit: restore it
      await tx.productLocationStock.updateMany({
        where: { productId: transfer.productId, location: transfer.fromLocation },
        data: { quantity: { increment: transfer.quantity } },
      });
      await tx.productLocationStock.updateMany({
        where: { productId: transfer.productId, location: transfer.toLocation },
        data: { quantity: { decrement: transfer.quantity } },
      });
      await syncProductStockTotal(tx, transfer.productId);
    }
    // For pending: stock was not moved — no stock adjustment needed

    return tx.stockTransfer.update({
      where: { id: transfer.id },
      data: { status: 'cancelled' },
      include: { product: { select: { name: true, sku: true } } },
    });
  });

  return {
    ok: true,
    transfer: {
      id: cancelled.id,
      status: cancelled.status,
      productId: cancelled.productId,
      productName: cancelled.product.name,
      productSku: cancelled.product.sku,
      fromLocation: cancelled.fromLocation,
      toLocation: cancelled.toLocation,
      quantity: cancelled.quantity,
      reason: cancelled.reason,
      notes: cancelled.notes,
      updatedAt: cancelled.updatedAt,
    },
  };
}
