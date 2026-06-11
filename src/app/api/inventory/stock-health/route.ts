import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { stockHealthBuckets } from '@/lib/db/inventory-product-view';
import {
  INVENTORY_LOCATION_STOCK_SELECT,
  isMissingInventoryTableError,
  toProductLocationRows,
} from '@/lib/db/inventory-api-helpers';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const threshold = parseInt(new URL(request.url).searchParams.get('threshold') || '20', 10);

    const products = await prisma.product.findMany({
      where: { isActive: true, ownerUserId: { in: workspaceUserIds } },
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        warehouseLocation: true,
        locationStocks: { select: INVENTORY_LOCATION_STOCK_SELECT },
      },
    });

    const normalized = products.map((p: { id: string; sku: string; name: string; stock: number; warehouseLocation: string | null; locationStocks: unknown[] }) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      stock: p.stock,
      warehouseLocation: p.warehouseLocation,
      locationStocks: toProductLocationRows(p.locationStocks),
    }));

    const { critical, low, warning } = stockHealthBuckets(normalized, threshold);

    return NextResponse.json({ critical, low, warning });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({ critical: [], low: [], warning: [] });
    }
    return NextResponse.json({ critical: [], low: [], warning: [] }, { status: 500 });
  }
}
