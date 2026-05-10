import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  ensureProductLocationStockRows,
  isWarehouseLocation,
  normalizeWarehouseLocation,
} from '@/lib/db/inventory-location-transfer';
import { isMissingInventoryTableError } from '@/lib/db/inventory-api-helpers';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ productId: string; location: string }> },
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { productId, location: locRaw } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    if (!isWarehouseLocation(locRaw)) {
      return NextResponse.json({ detail: 'Invalid location' }, { status: 400 });
    }
    const location = normalizeWarehouseLocation(locRaw);

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
        ownerUserId: { in: workspaceUserIds },
      },
      select: { id: true, stock: true, warehouseLocation: true },
    });

    if (!product) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
    }

    const reorderPoint = Math.max(0, Math.floor(Number(body.reorder_point ?? body.reorderPoint ?? 0)));
    const reorderQty = Math.max(0, Math.floor(Number(body.reorder_quantity ?? body.reorderQuantity ?? 0)));

    await prisma.$transaction(async (tx) => {
      await ensureProductLocationStockRows(tx, product);
      await tx.productLocationStock.update({
        where: { productId_location: { productId: product.id, location } },
        data: {
          reorderPoint,
          reorderQuantity: reorderQty > 0 ? reorderQty : null,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json(
        { detail: 'Run prisma migrate deploy to enable product_location_stock.' },
        { status: 503 },
      );
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
