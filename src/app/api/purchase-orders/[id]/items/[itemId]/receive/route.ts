import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { purchaseOrderToApi } from '@/lib/db/purchase-order-serialize';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { normalizeWarehouseLocation } from '@/lib/db/inventory-location-transfer';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  supplier: true,
  lines: { include: { product: true } },
} satisfies Prisma.PurchaseOrderInclude;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id: poId, itemId } = await context.params;
    const body = (await request.json()) as { quantity_received?: number };
    const qtyIn = Math.max(0, Math.floor(Number(body.quantity_received ?? 0)));
    if (qtyIn <= 0) {
      return NextResponse.json({ detail: 'quantity_received required' }, { status: 400 });
    }

    const updatedPo = await prisma.$transaction(async (tx) => {
      const line = await tx.purchaseOrderLine.findFirst({
        where: {
          id: itemId,
          purchaseOrderId: poId,
          purchaseOrder: { ownerUserId: scope.userId },
          product: { ownerUserId: scope.userId },
        },
        include: {
          product: true,
          purchaseOrder: { select: { deliveryLocation: true } },
        },
      });
      if (!line) {
        throw new Error('LINE_NOT_FOUND');
      }
      const remaining = line.quantity - line.quantityReceived;
      if (qtyIn > remaining) {
        throw new Error('EXCEEDS_REMAINING');
      }

      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: line.quantityReceived + qtyIn },
      });

      await tx.product.update({
        where: { id: line.productId },
        data: { stock: { increment: qtyIn } },
      });

      // UNI-2119: land the received stock in the PO's delivery warehouse, not
      // just the global counter, so location stock reflects the receipt.
      const location = normalizeWarehouseLocation(line.purchaseOrder.deliveryLocation);
      await tx.productLocationStock.upsert({
        where: { productId_location: { productId: line.productId, location } },
        update: { quantity: { increment: qtyIn } },
        create: { productId: line.productId, location, quantity: qtyIn },
      });

      const allLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: poId } });
      const fullyReceived = allLines.every((l) => {
        const recv = l.id === line.id ? l.quantityReceived + qtyIn : l.quantityReceived;
        return recv >= l.quantity;
      });

      return tx.purchaseOrder.update({
        where: { id: poId },
        data: fullyReceived
          ? { status: 'received', actualDeliveryDate: new Date() }
          : { status: 'in_transit' },
        include: INCLUDE,
      });
    });

    return NextResponse.json(purchaseOrderToApi(updatedPo));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'LINE_NOT_FOUND') return NextResponse.json({ detail: 'Line not found' }, { status: 404 });
    if (msg === 'EXCEEDS_REMAINING') {
      return NextResponse.json({ detail: 'Quantity exceeds remaining' }, { status: 400 });
    }
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
