import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  expandWarehouseLocations,
  totalsFromExpanded,
  DEFAULT_REORDER_THRESHOLD,
} from '@/lib/db/inventory-product-view';
import {
  INVENTORY_LOCATION_STOCK_SELECT,
  isMissingInventoryTableError,
  toProductLocationRows,
} from '@/lib/db/inventory-api-helpers';
import { isWarehouseLocation } from '@/lib/db/inventory-location-transfer';

function toInventoryItem(p: {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  warehouseLocation: string | null;
  createdAt: Date;
  updatedAt: Date;
  locationStocks: Array<{
    location: string;
    quantity: number;
    reserved: number;
    reorderPoint: number | null;
    reorderQuantity: number | null;
    leadTimeDays: number;
    autoApproveUnderQty: number;
    reorderEnabled: boolean;
  }>;
}) {
  const rows = toProductLocationRows(p.locationStocks);
  const locs = expandWarehouseLocations(p.stock, p.warehouseLocation, rows);
  const { totalStock, totalReserved, totalAvailable } = totalsFromExpanded(locs);

  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    price: p.price,
    stock_by_location: locs.map((l) => ({
      location: l.location,
      stock: l.stock,
      reserved: l.reserved,
      available: l.available,
      reorder_point: l.reorder_point,
      reorder_quantity: l.reorder_quantity,
    })),
    total_stock: totalStock,
    total_reserved: totalReserved,
    total_available: totalAvailable,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
    const search = searchParams.get('search')?.trim();
    const locationFilter = searchParams.get('location')?.toLowerCase().trim();
    const lowStock = searchParams.get('low_stock') === 'true';
    const sortBy = searchParams.get('sort_by') || 'name';
    const sortOrder = searchParams.get('sort_order') === 'desc' ? 'desc' : 'asc';

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ownerUserId: { in: workspaceUserIds },
    };

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        stock: true,
        warehouseLocation: true,
        createdAt: true,
        updatedAt: true,
        locationStocks: { select: INVENTORY_LOCATION_STOCK_SELECT },
      },
    });

    let items = products.map(toInventoryItem);

    if (lowStock) {
      items = items.filter((i) => i.total_available <= DEFAULT_REORDER_THRESHOLD);
    }

    if (locationFilter && isWarehouseLocation(locationFilter)) {
      items = items.filter((i) =>
        i.stock_by_location.some(
          (s) => s.location === locationFilter && (s.stock > 0 || s.reserved > 0),
        ),
      );
    }

    const sortKey = ['name', 'sku', 'price', 'stock', 'total_available'].includes(sortBy)
      ? sortBy
      : 'name';

    items.sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      switch (sortKey) {
        case 'sku':
          av = a.sku.toLowerCase();
          bv = b.sku.toLowerCase();
          break;
        case 'price':
          av = a.price;
          bv = b.price;
          break;
        case 'stock':
          av = a.total_stock;
          bv = b.total_stock;
          break;
        case 'total_available':
          av = a.total_available;
          bv = b.total_available;
          break;
        default:
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
      }
      if (av < bv) return sortOrder === 'asc' ? -1 : 1;
      if (av > bv) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = items.length;
    const slice = items.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      items: slice,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({
        items: [],
        total: 0,
        page: 1,
        page_size: 50,
        total_pages: 0,
        detail: 'Run prisma migrate deploy.',
      });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
