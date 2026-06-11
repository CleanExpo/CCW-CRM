import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  ensureProductLocationStockRows,
  isWarehouseLocation,
  normalizeWarehouseLocation,
  syncProductStockTotal,
} from '@/lib/db/inventory-location-transfer';
import { isMissingInventoryTableError } from '@/lib/db/inventory-api-helpers';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
    }

    const productId = String(body.product_id ?? '').trim();
    const locRaw = String(body.location ?? '').toLowerCase().trim();
    const quantityChange = Math.trunc(Number(body.quantity_change ?? 0));

    if (!productId) {
      return NextResponse.json({ detail: 'product_id is required' }, { status: 400 });
    }
    if (!isWarehouseLocation(locRaw)) {
      return NextResponse.json({ detail: 'Invalid location' }, { status: 400 });
    }
    if (!Number.isFinite(quantityChange) || quantityChange === 0) {
      return NextResponse.json({ detail: 'quantity_change must be non-zero' }, { status: 400 });
    }

    const location = normalizeWarehouseLocation(locRaw);

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
      const row = await tx.productLocationStock.findUniqueOrThrow({
        where: { productId_location: { productId: product.id, location } },
      });
      const nextQty = row.quantity + quantityChange;
      if (nextQty < row.reserved) {
        throw new Error(
          `Adjusted quantity would be below reserved (${row.reserved}). Release reservations first.`,
        );
      }
      if (nextQty < 0) {
        throw new Error('Adjusted quantity cannot be negative');
      }
      await tx.productLocationStock.update({
        where: { id: row.id },
        data: { quantity: nextQty },
      });
      await syncProductStockTotal(tx, product.id);
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('below reserved') || msg.includes('cannot be negative')) {
      return NextResponse.json({ detail: msg }, { status: 400 });
    }
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({ detail: 'Run prisma migrate deploy.' }, { status: 503 });
    }
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
