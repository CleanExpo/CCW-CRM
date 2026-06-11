import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { purchaseOrderToApi } from '@/lib/db/purchase-order-serialize';
import { requireAuthScope } from '@/lib/auth/data-scope';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  supplier: true,
  lines: { include: { product: true } },
} satisfies Prisma.PurchaseOrderInclude;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(_request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const row = await prisma.purchaseOrder.findFirst({
      where: { id, ownerUserId: scope.userId },
      include: INCLUDE,
    });
    if (!row) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    return NextResponse.json(purchaseOrderToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id, ownerUserId: scope.userId },
    });
    if (!existing) return NextResponse.json({ detail: 'Not found' }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const hasItems = 'items' in body && Array.isArray(body.items);

    if (!hasItems) {
      const data: Prisma.PurchaseOrderUpdateInput = {};
      if (body.status != null) data.status = String(body.status);
      if (body.supplier_id != null) {
        const targetSupplierId = String(body.supplier_id);
        const targetSupplier = await prisma.supplier.findFirst({
          where: { id: targetSupplierId, ownerUserId: scope.userId, isActive: true },
          select: { id: true },
        });
        if (!targetSupplier) {
          return NextResponse.json({ detail: 'Supplier not found' }, { status: 404 });
        }
        data.supplier = { connect: { id: targetSupplierId } };
      }
      if (body.delivery_location != null) data.deliveryLocation = String(body.delivery_location);
      if (body.expected_delivery_date != null) {
        data.expectedDeliveryDate = new Date(String(body.expected_delivery_date));
      }
      if (body.notes !== undefined) data.notes = body.notes == null ? null : String(body.notes);
      if (body.shipping_cost !== undefined) {
        data.shippingCost =
          body.shipping_cost == null ? null : Number(body.shipping_cost);
      }
      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data,
        include: INCLUDE,
      });
      return NextResponse.json(purchaseOrderToApi(updated));
    }

    const supplierId = String(body.supplier_id ?? existing.supplierId);
    const deliveryLocation = String(body.delivery_location ?? existing.deliveryLocation);
    const rawItems = body.items as Array<{
      product_id?: string;
      quantity?: number;
      unit_cost?: number;
    }>;

    const ids = [...new Set(rawItems.map((i) => String(i.product_id ?? '')).filter(Boolean))];
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, ownerUserId: scope.userId, isActive: true },
      select: { id: true },
    });
    if (!supplier) {
      return NextResponse.json({ detail: 'Supplier not found' }, { status: 404 });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: ids }, ownerUserId: scope.userId, isActive: true },
    });
    const byId = new Map(products.map((p: typeof products[number]) => [p.id, p]));

    let subtotal = 0;
    const lineCreates: Array<{
      productId: string;
      quantity: number;
      quantityReceived: number;
      unitCost: number;
      subtotal: number;
    }> = [];

    for (const row of rawItems) {
      const pid = String(row.product_id ?? '');
      const qty = Math.max(0, Math.floor(Number(row.quantity ?? 0)));
      const unitCost = Number(row.unit_cost ?? 0);
      if (!pid || qty <= 0) continue;
      const p = byId.get(pid);
      if (!p) return NextResponse.json({ detail: `Unknown product ${pid}` }, { status: 400 });
      const lineSub = qty * unitCost;
      subtotal += lineSub;
      lineCreates.push({
        productId: pid,
        quantity: qty,
        quantityReceived: 0,
        unitCost,
        subtotal: lineSub,
      });
    }
    if (lineCreates.length === 0) {
      return NextResponse.json({ detail: 'No valid line items' }, { status: 400 });
    }

    const shipping = body.shipping_cost != null ? Number(body.shipping_cost) : existing.shippingCost ?? 0;
    const tax = subtotal * 0.1;
    const total = subtotal + tax + Number(shipping);

    const updated = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId,
          deliveryLocation,
          status: body.status != null ? String(body.status) : existing.status,
          expectedDeliveryDate: body.expected_delivery_date
            ? new Date(String(body.expected_delivery_date))
            : existing.expectedDeliveryDate,
          notes: body.notes != null ? String(body.notes) : existing.notes,
          shippingCost: body.shipping_cost != null ? Number(body.shipping_cost) : existing.shippingCost,
          subtotal,
          tax,
          total,
          lines: { create: lineCreates },
        },
        include: INCLUDE,
      });
    });

    return NextResponse.json(purchaseOrderToApi(updated));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
