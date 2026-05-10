import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  ensureProductLocationStockRows,
  isWarehouseLocation,
  normalizeWarehouseLocation,
  syncProductStockTotal,
} from '@/lib/db/inventory-location-transfer';

function transferToApi(
  row: {
    id: string;
    productId: string;
    fromLocation: string;
    toLocation: string;
    quantity: number;
    status: string;
    reason: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    product: { name: string; sku: string };
  },
  userId: string,
) {
  const completedAt = row.status === 'completed' ? row.createdAt.toISOString() : undefined;
  return {
    id: row.id,
    product_id: row.productId,
    product_name: row.product.name,
    product_sku: row.product.sku,
    from_location: row.fromLocation,
    to_location: row.toLocation,
    quantity: row.quantity,
    status: row.status,
    reason: row.reason ?? undefined,
    notes: row.notes ?? undefined,
    initiated_by: userId,
    initiated_at: row.createdAt.toISOString(),
    completed_by: row.status === 'completed' ? userId : undefined,
    completed_at: completedAt,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function isMissingInventoryTablesError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /product_location_stock|stock_transfers/i.test(msg) &&
    /does not exist|relation|no such table/i.test(msg)
  );
}

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

    const productId = String(body.product_id ?? body.productId ?? '').trim();
    if (!productId) {
      return NextResponse.json({ detail: 'product_id is required' }, { status: 400 });
    }

    const fromRaw = String(body.from_location ?? body.fromLocation ?? '').toLowerCase().trim();
    const toRaw = String(body.to_location ?? body.toLocation ?? '').toLowerCase().trim();
    if (!isWarehouseLocation(fromRaw) || !isWarehouseLocation(toRaw)) {
      return NextResponse.json(
        { detail: 'from_location and to_location must be brisbane, sydney, or melbourne' },
        { status: 400 },
      );
    }
    const fromLoc = normalizeWarehouseLocation(fromRaw);
    const toLoc = normalizeWarehouseLocation(toRaw);
    if (fromLoc === toLoc) {
      return NextResponse.json(
        { detail: 'Source and destination locations must differ' },
        { status: 400 },
      );
    }

    const quantity = Math.floor(Number(body.quantity ?? 0));
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json({ detail: 'quantity must be at least 1' }, { status: 400 });
    }

    const reason = body.reason != null ? String(body.reason).trim() || null : null;
    const notes = body.notes != null ? String(body.notes).trim() || null : null;

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

    const created = await prisma.$transaction(async (tx) => {
      await ensureProductLocationStockRows(tx, product);

      const fromRow = await tx.productLocationStock.findUnique({
        where: {
          productId_location: { productId: product.id, location: fromLoc },
        },
      });
      const toRow = await tx.productLocationStock.findUnique({
        where: {
          productId_location: { productId: product.id, location: toLoc },
        },
      });

      if (!fromRow || !toRow) {
        throw new Error('Location stock rows missing after initialization');
      }

      const available = fromRow.quantity - fromRow.reserved;
      if (available < quantity) {
        const err = new Error(
          `Insufficient available stock at ${fromLoc} (available ${available}, requested ${quantity})`,
        );
        (err as Error & { code: string }).code = 'INSUFFICIENT_STOCK';
        throw err;
      }

      await tx.productLocationStock.update({
        where: { id: fromRow.id },
        data: { quantity: { decrement: quantity } },
      });
      await tx.productLocationStock.update({
        where: { id: toRow.id },
        data: { quantity: { increment: quantity } },
      });

      const { id: transferId } = await tx.stockTransfer.create({
        data: {
          ownerUserId: scope.userId,
          productId: product.id,
          fromLocation: fromLoc,
          toLocation: toLoc,
          quantity,
          status: 'completed',
          reason,
          notes,
        },
        select: { id: true },
      });

      await syncProductStockTotal(tx, product.id);

      return tx.stockTransfer.findUniqueOrThrow({
        where: { id: transferId },
        include: { product: { select: { name: true, sku: true } } },
      });
    });

    return NextResponse.json(transferToApi(created, scope.userId), { status: 201 });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === 'INSUFFICIENT_STOCK' || err.message.includes('Insufficient available stock')) {
      return NextResponse.json({ detail: err.message }, { status: 400 });
    }
    if (isMissingInventoryTablesError(e)) {
      return NextResponse.json(
        {
          detail:
            'Inventory tables are not in the database. Run `npx prisma migrate deploy` (or `prisma migrate dev`) and try again.',
        },
        { status: 503 },
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        return NextResponse.json(
          { detail: 'Transfer conflict — retry. If this persists, refresh and try again.' },
          { status: 409 },
        );
      }
    }
    console.error('[POST /api/inventory/transfer]', e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
