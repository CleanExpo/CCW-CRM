import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  ensureProductLocationStockRows,
  WAREHOUSE_LOCATIONS,
} from '@/lib/db/inventory-location-transfer';
import { DEFAULT_REORDER_THRESHOLD } from '@/lib/db/inventory-product-view';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ productId: string }> },
) {
  try {
    const scope = await requireAuthScope(_request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { productId } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

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

    await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      await ensureProductLocationStockRows(tx, product);
    });

    const rows = await prisma.productLocationStock.findMany({
      where: { productId: product.id },
    });

    const byLoc = new Map(rows.map((r: (typeof rows)[number]) => [r.location, r] as [string, (typeof rows)[number]]));

    const items = WAREHOUSE_LOCATIONS.map((loc) => {
      const r = byLoc.get(loc);
      const stock = r?.quantity ?? 0;
      const reserved = r?.reserved ?? 0;
      return {
        location: loc,
        stock,
        reserved,
        available: Math.max(0, stock - reserved),
        reorder_point: r?.reorderPoint ?? DEFAULT_REORDER_THRESHOLD,
        reorder_quantity: r?.reorderQuantity ?? Math.max(DEFAULT_REORDER_THRESHOLD, 10),
      };
    });

    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
