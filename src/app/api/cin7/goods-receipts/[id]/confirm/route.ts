import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { grnToApi } from '@/lib/db/grn-serialize';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const grn = await prisma.goodsReceipt.findUnique({
      where: { id },
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
          await tx.product.update({
            where: { id: line.productId },
            data: { stock: { increment: line.receivedQty } },
          });
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
    });

    const updated = await prisma.goodsReceipt.findUniqueOrThrow({
      where: { id },
      include: { lines: true },
    });
    return NextResponse.json(grnToApi(updated));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
