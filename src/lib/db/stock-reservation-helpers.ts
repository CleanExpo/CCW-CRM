import type { PrismaClient } from '@prisma/client';

/**
 * Marks expired reservations and returns reserved quantities to location stock.
 */
export async function expireDueStockReservations(
  prisma: PrismaClient,
  workspaceUserIds: string[],
): Promise<void> {
  const due = await prisma.stockReservation.findMany({
    where: {
      status: 'active',
      expiresAt: { lte: new Date() },
      product: { ownerUserId: { in: workspaceUserIds } },
    },
  });

  for (const r of due) {
    await prisma.$transaction(async (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => {
      const row = await tx.productLocationStock.findUnique({
        where: { productId_location: { productId: r.productId, location: r.location } },
      });
      if (row) {
        await tx.productLocationStock.update({
          where: { id: row.id },
          data: { reserved: Math.max(0, row.reserved - r.quantity) },
        });
      }
      await tx.stockReservation.update({
        where: { id: r.id },
        data: { status: 'expired' },
      });
    });
  }
}
