import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { refreshGrnTotals } from '@/lib/db/grn-serialize';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { id: grnId, lineId } = await context.params;
    const grn = await prisma.goodsReceipt.findFirst({
      where: { id: grnId, ownerUserId: scope.userId },
    });
    if (!grn) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    if (grn.status !== 'draft') {
      return NextResponse.json({ detail: 'Can only edit draft receipts' }, { status: 400 });
    }

    const line = await prisma.goodsReceiptLine.findFirst({
      where: { id: lineId, goodsReceiptId: grnId },
    });
    if (!line) return NextResponse.json({ detail: 'Line not found' }, { status: 404 });

    await prisma.goodsReceiptLine.delete({ where: { id: lineId } });
    await refreshGrnTotals(grnId);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }
}
