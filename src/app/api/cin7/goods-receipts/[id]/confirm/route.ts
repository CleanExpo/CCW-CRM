import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { grnToApi } from '@/lib/db/grn-serialize';
import { recordStockMovements } from '@/lib/inventory/stock-movement';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const uid = scope.userId;
    const { id } = await context.params;
    const grn = await prisma.goodsReceipt.findFirst({
      where: { id, ownerUserId: uid },
      include: { lines: true },
    });
    if (!grn) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    if (grn.status !== 'draft') {
      return NextResponse.json({ detail: 'Receipt is not draft' }, { status: 400 });
    }
    if (grn.lines.length === 0) {
      return NextResponse.json({ detail: 'Add at least one line before confirming' }, { status: 400 });
    }

    const now = new Date();
    const receiptId = `GRN-${grn.poReference}-${Date.now().toString(36).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      for (const line of grn.lines) {
        if (line.productId) {
          const inc = await tx.product.updateMany({
            where: { id: line.productId, ownerUserId: uid },
            data: { stock: { increment: line.receivedQty } },
          });
          if (inc.count !== 1) {
            throw new Error(`Could not update stock for product ${line.productId}`);
          }
        }
      }
      await tx.goodsReceipt.update({
        where: { id },
        data: {
          status: 'confirmed',
          confirmedAt: now,
          cin7ReceiptId: receiptId,
        },
      });
      await recordStockMovements(
        tx,
        grn.lines
          .filter((line) => line.receivedQty !== 0 && line.sku)
          .map((line) => ({
            ownerUserId: uid,
            productId: line.productId,
            sku: line.sku,
            branchName: grn.locationId || 'unassigned',
            quantity: line.receivedQty,
            movementType: 'receipt' as const,
            sourceType: 'goods_receipt',
            sourceId: grn.id,
          }))
      );
    });

    const updated = await prisma.goodsReceipt.findFirstOrThrow({
      where: { id, ownerUserId: uid },
      include: { lines: true },
    });
    return NextResponse.json(grnToApi(updated));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
