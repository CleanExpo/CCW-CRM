import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { isMissingInventoryTableError } from '@/lib/db/inventory-api-helpers';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const reservation = await prisma.stockReservation.findFirst({
      where: {
        id,
        status: 'active',
        product: { ownerUserId: { in: workspaceUserIds } },
      },
    });

    if (!reservation) {
      return NextResponse.json({ detail: 'Reservation not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const row = await tx.productLocationStock.findUnique({
        where: {
          productId_location: { productId: reservation.productId, location: reservation.location },
        },
      });
      if (row) {
        await tx.productLocationStock.update({
          where: { id: row.id },
          data: { reserved: Math.max(0, row.reserved - reservation.quantity) },
        });
      }
      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({ detail: 'Run prisma migrate deploy.' }, { status: 503 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
