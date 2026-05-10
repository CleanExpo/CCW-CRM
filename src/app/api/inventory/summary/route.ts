import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  countBelowReorderLines,
  expandWarehouseLocations,
  totalsFromExpanded,
} from '@/lib/db/inventory-product-view';
import { INVENTORY_LOCATION_STOCK_SELECT, isMissingInventoryTableError, toProductLocationRows } from '@/lib/db/inventory-api-helpers';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const products = await prisma.product.findMany({
      where: { isActive: true, ownerUserId: { in: workspaceUserIds } },
      select: {
        id: true,
        price: true,
        stock: true,
        warehouseLocation: true,
        locationStocks: { select: INVENTORY_LOCATION_STOCK_SELECT },
      },
    });

    let totalStockValue = 0;
    let belowReorderPoint = 0;

    for (const p of products) {
      const rows = toProductLocationRows(p.locationStocks);
      const locs = expandWarehouseLocations(p.stock, p.warehouseLocation, rows);
      const { totalStock } = totalsFromExpanded(locs);
      totalStockValue += p.price * totalStock;
      belowReorderPoint += countBelowReorderLines(locs);
    }

    const activeReservations = await prisma.stockReservation.count({
      where: {
        status: 'active',
        product: { ownerUserId: { in: workspaceUserIds } },
      },
    });

    return NextResponse.json({
      total_skus: products.length,
      total_stock_value: Math.round(totalStockValue * 100) / 100,
      below_reorder_point: belowReorderPoint,
      active_reservations: activeReservations,
    });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({
        total_skus: 0,
        total_stock_value: 0,
        below_reorder_point: 0,
        active_reservations: 0,
        detail: 'Run prisma migrate deploy to enable inventory tables.',
      });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
