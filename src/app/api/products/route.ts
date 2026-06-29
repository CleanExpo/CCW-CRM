import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { productToApi } from '@/lib/db/api-serialize';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { expandWarehouseLocations } from '@/lib/db/inventory-product-view';
import type { Prisma, Product, ProductLocationStock } from '@prisma/client';

function productToApiWithOptionalStock(
  product: Product & { locationStocks?: ProductLocationStock[] },
  includeStock: boolean
) {
  const base = productToApi(product);
  if (!includeStock) return base;

  const locs = expandWarehouseLocations(
    product.stock,
    product.warehouseLocation,
    (product.locationStocks ?? []).map((row) => ({
      location: row.location,
      quantity: row.quantity,
      reserved: row.reserved,
      reorderPoint: row.reorderPoint,
      reorderQuantity: row.reorderQuantity,
      leadTimeDays: row.leadTimeDays,
      autoApproveUnderQty: row.autoApproveUnderQty,
      reorderEnabled: row.reorderEnabled,
    }))
  );

  return {
    ...base,
    stock_by_location: locs.map((loc) => ({
      location: loc.location,
      stock: loc.stock,
      reserved: loc.reserved,
      available: loc.available,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '50', 10), 200);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const includeInactive =
      searchParams.get('include_inactive') === 'true' ||
      searchParams.get('include_inactive') === '1';
    const includeStock =
      searchParams.get('include_stock') === 'true' ||
      searchParams.get('include_stock') === '1';

    const where: Prisma.ProductWhereInput = { ownerUserId: { in: workspaceUserIds } };
    if (!includeInactive) {
      where.isActive = true;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: includeStock ? { locationStocks: true } : undefined,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map((row) => productToApiWithOptionalStock(row, includeStock)),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const body = (await request.json()) as Record<string, unknown>;
    const row = await prisma.product.create({
      data: {
        ownerUserId: scope.userId,
        name: String(body.name ?? ''),
        sku: String(body.sku ?? ''),
        category: (body.category as string) ?? null,
        price: Number(body.price ?? 0),
        stock: Number(body.stock ?? 0),
        isActive: (body.is_active as boolean) ?? (body.isActive as boolean) ?? true,
        warehouseLocation:
          (body.warehouse_location as string) ?? (body.warehouseLocation as string) ?? null,
      },
    });
    return NextResponse.json(productToApi(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
