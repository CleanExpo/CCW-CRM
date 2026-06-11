import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import type { Prisma } from '@prisma/client';
import {
  ensureProductLocationStockRows,
  isWarehouseLocation,
  normalizeWarehouseLocation,
} from '@/lib/db/inventory-location-transfer';
import { expandWarehouseLocations } from '@/lib/db/inventory-product-view';
import { INVENTORY_LOCATION_STOCK_SELECT, isMissingInventoryTableError, toProductLocationRows } from '@/lib/db/inventory-api-helpers';

const PO_INCLUDE = {
  supplier: true,
  lines: { include: { product: true } },
} satisfies Prisma.PurchaseOrderInclude;

function genPoNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const r = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `PO-${y}${m}${day}-${r}`;
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id')?.trim();
    const locRaw = searchParams.get('location')?.toLowerCase().trim() || 'brisbane';

    if (!productId) {
      return NextResponse.json({ detail: 'product_id is required' }, { status: 400 });
    }
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
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stock: true,
        warehouseLocation: true,
        locationStocks: { select: INVENTORY_LOCATION_STOCK_SELECT },
      },
    });

    if (!product) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      await ensureProductLocationStockRows(tx, {
        id: product.id,
        stock: product.stock,
        warehouseLocation: product.warehouseLocation,
      });
    });

    const refreshed = await prisma.product.findFirst({
      where: { id: product.id },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stock: true,
        warehouseLocation: true,
        locationStocks: { select: INVENTORY_LOCATION_STOCK_SELECT },
      },
    });
    if (!refreshed) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { ownerUserId: { in: workspaceUserIds }, isActive: true },
      orderBy: { companyName: 'asc' },
    });

    if (!supplier) {
      return NextResponse.json(
        { detail: 'No active supplier found. Add a supplier before auto-reorder.' },
        { status: 400 },
      );
    }

    const rows = toProductLocationRows(refreshed.locationStocks);
    const locs = expandWarehouseLocations(refreshed.stock, refreshed.warehouseLocation, rows);
    const loc = locs.find((l) => l.location === location)!;
    const orderQty = Math.max(
      loc.reorder_quantity,
      loc.reorder_point - loc.available + Math.max(10, Math.ceil(loc.reorder_point * 0.25)),
    );
    const qty = Math.max(1, Math.floor(orderQty));
    const unitCost = refreshed.price > 0 ? refreshed.price * 0.65 : 1;
    const subtotal = qty * unitCost;
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    const created = await prisma.purchaseOrder.create({
      data: {
        ownerUserId: scope.userId,
        poNumber: genPoNumber(),
        supplierId: supplier.id,
        deliveryLocation: location,
        status: 'draft',
        notes: `Auto-reorder for ${refreshed.sku} (${refreshed.name}) — low stock at ${location}.`,
        subtotal,
        tax,
        total,
        lines: {
          create: [
            {
              productId: refreshed.id,
              quantity: qty,
              quantityReceived: 0,
              unitCost,
              subtotal,
            },
          ],
        },
      },
      include: PO_INCLUDE,
    });

    return NextResponse.json({
      success: true,
      po_number: created.poNumber,
      po_id: created.id,
      status: created.status,
      quantity: qty,
    });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({ detail: 'Run prisma migrate deploy.' }, { status: 503 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
