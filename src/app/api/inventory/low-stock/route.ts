import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { expandWarehouseLocations, totalsFromExpanded } from '@/lib/db/inventory-product-view';
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

    const out: Array<{
      product_id: string;
      sku: string;
      name: string;
      stock: number;
      reserved: number;
      available: number;
      reorder_point?: number;
      locations?: Array<{
        location: string;
        stock: number;
        reserved: number;
        available: number;
        reorder_point: number;
        reorder_quantity: number;
      }>;
    }> = [];

    for (const p of products) {
      const rows = toProductLocationRows(p.locationStocks);
      const locs = expandWarehouseLocations(p.stock, p.warehouseLocation, rows);
      const { totalAvailable, totalReserved } = totalsFromExpanded(locs);
      if (totalAvailable > threshold) continue;

      out.push({
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        stock: locs.reduce((s, l) => s + l.stock, 0),
        reserved: totalReserved,
        available: totalAvailable,
        locations: locs.map((l) => ({
          location: l.location,
          stock: l.stock,
          reserved: l.reserved,
          available: l.available,
          reorder_point: l.reorder_point,
          reorder_quantity: l.reorder_quantity,
        })),
      });
    }

    out.sort((a, b) => a.available - b.available);
    return NextResponse.json(out);
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
