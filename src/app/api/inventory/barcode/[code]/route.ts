import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { expandWarehouseLocations } from '@/lib/db/inventory-product-view';
import {
  INVENTORY_LOCATION_STOCK_SELECT,
  toProductLocationRows,
} from '@/lib/db/inventory-api-helpers';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { code: raw } = await context.params;
    const code = decodeURIComponent(raw ?? '').trim();
    if (!code) {
      return NextResponse.json({ detail: 'code is required' }, { status: 400 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);

    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        ownerUserId: { in: workspaceUserIds },
        OR: [
          { sku: { equals: code, mode: 'insensitive' } },
          ...(uuidLike ? [{ id: code }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        warehouseLocation: true,
        locationStocks: { select: INVENTORY_LOCATION_STOCK_SELECT },
      },
    });

    if (!product) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }

    const rows = toProductLocationRows(product.locationStocks);
    const locs = expandWarehouseLocations(product.stock, product.warehouseLocation, rows);

    return NextResponse.json({
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      barcodes: [{ barcode: product.sku, barcode_type: 'SKU' }],
      stock_by_location: locs.map((l) => ({
        location: l.location,
        stock_quantity: l.stock,
      })),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
