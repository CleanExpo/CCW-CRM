import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  ensureProductLocationStockRows,
  syncProductStockTotal,
} from '@/lib/db/inventory-location-transfer';
import { isMissingInventoryTableError } from '@/lib/db/inventory-api-helpers';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ takeId: string }> },
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { takeId } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 });
    }

    const rawItems = body.items as Array<{ product_id?: string; counted_qty?: number }> | undefined;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ detail: 'items array required' }, { status: 400 });
    }

    const take = await prisma.inventoryStockTake.findFirst({
      where: { id: takeId, ownerUserId: scope.userId },
    });

    if (!take) {
      return NextResponse.json({ detail: 'Stock take not found' }, { status: 404 });
    }
    if (take.status !== 'in_progress') {
      return NextResponse.json({ detail: 'Stock take is not open' }, { status: 400 });
    }

    let processed = 0;

    await prisma.$transaction(async (tx) => {
      for (const it of rawItems) {
        const productId = String(it.product_id ?? '').trim();
        const countedQty = Math.max(0, Math.floor(Number(it.counted_qty ?? 0)));
        if (!productId) continue;

        const product = await tx.product.findFirst({
          where: {
            id: productId,
            isActive: true,
            ownerUserId: { in: workspaceUserIds },
          },
          select: { id: true, stock: true, warehouseLocation: true },
        });
        if (!product) continue;

        await ensureProductLocationStockRows(tx, product);
        const row = await tx.productLocationStock.findUniqueOrThrow({
          where: { productId_location: { productId: product.id, location: take.location } },
        });

        await tx.productLocationStock.update({
          where: { id: row.id },
          data: {
            quantity: countedQty,
            reserved: Math.min(row.reserved, countedQty),
          },
        });
        await syncProductStockTotal(tx, product.id);

        await tx.inventoryStockTakeLine.upsert({
          where: {
            takeId_productId: { takeId: take.id, productId: product.id },
          },
          create: {
            takeId: take.id,
            productId: product.id,
            countedQty,
          },
          update: { countedQty },
        });
        processed += 1;
      }

      await tx.inventoryStockTake.update({
        where: { id: take.id },
        data: { status: 'submitted', submittedAt: new Date() },
      });
    });

    return NextResponse.json({
      success: true,
      take_id: takeId,
      items_processed: processed,
    });
  } catch (e) {
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({ detail: 'Run prisma migrate deploy.' }, { status: 503 });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
