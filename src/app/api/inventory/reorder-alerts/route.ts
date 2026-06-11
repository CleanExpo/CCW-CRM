import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { expandWarehouseLocations } from '@/lib/db/inventory-product-view';
import { INVENTORY_LOCATION_STOCK_SELECT, isMissingInventoryTableError, toProductLocationRows } from '@/lib/db/inventory-api-helpers';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const locationFilter = searchParams.get('location')?.toLowerCase().trim();

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

    const supplierByProduct = new Map<
      string,
      { supplier_id: string | null; supplier_name: string | null }
    >();

    const productIds = products.map((p: { id: string }) => p.id);
    if (productIds.length > 0) {
      const lines = await prisma.purchaseOrderLine.findMany({
        where: {
          productId: { in: productIds },
          purchaseOrder: { ownerUserId: { in: workspaceUserIds } },
        },
        select: {
          productId: true,
          purchaseOrder: {
            select: {
              createdAt: true,
              supplier: { select: { id: true, companyName: true } },
            },
          },
        },
      });
      lines.sort(
        (a: { purchaseOrder: { createdAt: Date } }, b: { purchaseOrder: { createdAt: Date } }) =>
          b.purchaseOrder.createdAt.getTime() - a.purchaseOrder.createdAt.getTime(),
      );
      for (const line of lines) {
        if (!supplierByProduct.has(line.productId)) {
          supplierByProduct.set(line.productId, {
            supplier_id: line.purchaseOrder.supplier.id,
            supplier_name: line.purchaseOrder.supplier.companyName,
          });
        }
      }
    }

    const alerts: Array<{
      product_id: string;
      sku: string;
      name: string;
      location: string;
      stock: number;
      reorder_point: number;
      reorder_quantity: number | null;
      supplier_id: string | null;
      supplier_name: string | null;
    }> = [];

    for (const p of products) {
      const rows = toProductLocationRows(p.locationStocks);
      const locs = expandWarehouseLocations(p.stock, p.warehouseLocation, rows);
      const sup = supplierByProduct.get(p.id) ?? { supplier_id: null, supplier_name: null };

      for (const l of locs) {
        if (locationFilter && l.location !== locationFilter) continue;
        if (l.available >= l.reorder_point) continue;
        alerts.push({
          product_id: p.id,
          sku: p.sku,
          name: p.name,
          location: l.location,
          stock: l.available,
          reorder_point: l.reorder_point,
          reorder_quantity: l.reorder_quantity,
          supplier_id: sup.supplier_id,
          supplier_name: sup.supplier_name,
        });
      }
    }

    alerts.sort((a, b) => a.stock - b.stock || a.sku.localeCompare(b.sku));

    return NextResponse.json(alerts);
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
