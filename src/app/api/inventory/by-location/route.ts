import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { expandWarehouseLocations } from '@/lib/db/inventory-product-view';
import {
  INVENTORY_LOCATION_STOCK_SELECT,
  isMissingInventoryTableError,
  toProductLocationRows,
} from '@/lib/db/inventory-api-helpers';
import { isWarehouseLocation, normalizeWarehouseLocation } from '@/lib/db/inventory-location-transfer';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const locParam = searchParams.get('location')?.toLowerCase().trim() || 'brisbane';
    if (!isWarehouseLocation(locParam)) {
      return NextResponse.json({ detail: 'location must be brisbane, sydney, or melbourne' }, { status: 400 });
    }
    const location = normalizeWarehouseLocation(locParam);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
    const search = searchParams.get('search')?.trim().toLowerCase();

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ownerUserId: { in: workspaceUserIds },
        ...(search
          ? {
              OR: [
                { sku: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        stock: true,
        warehouseLocation: true,
        locationStocks: { select: INVENTORY_LOCATION_STOCK_SELECT },
      },
    });

    const itemsAll = products.map((p) => {
      const rows = toProductLocationRows(p.locationStocks);
      const locs = expandWarehouseLocations(p.stock, p.warehouseLocation, rows);
      const row = locs.find((l) => l.location === location)!;
      return {
        product_id: p.id,
        product_name: p.name,
        product_sku: p.sku,
        stock: row.stock,
        reserved: row.reserved,
        available: row.available,
        reorder_point: row.reorder_point,
        below_reorder_point: row.available < row.reorder_point,
      };
    });

    const total = itemsAll.length;
    const slice = itemsAll.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      location,
      items: slice,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({
        location: 'brisbane',
        items: [],
        total: 0,
        page: 1,
        page_size: 50,
        total_pages: 1,
        detail: 'Run prisma migrate deploy.',
      });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
