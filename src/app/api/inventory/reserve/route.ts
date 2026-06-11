import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import {
  ensureProductLocationStockRows,
  isWarehouseLocation,
  normalizeWarehouseLocation,
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
    const orderId = String(body.order_id ?? '').trim();
    const locRaw = String(body.location ?? '').toLowerCase().trim();
    const quantity = Math.floor(Number(body.quantity ?? 0));
    const expiresAtRaw = body.expires_at != null ? String(body.expires_at) : null;

    if (!productId || !orderId) {
      return NextResponse.json({ detail: 'product_id and order_id are required' }, { status: 400 });
    }
    if (!isWarehouseLocation(locRaw)) {
      return NextResponse.json({ detail: 'Invalid location' }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json({ detail: 'quantity must be at least 1' }, { status: 400 });
    }

    const location = normalizeWarehouseLocation(locRaw);
    const expiresAt =
      expiresAtRaw && !Number.isNaN(Date.parse(expiresAtRaw)) ? new Date(expiresAtRaw) : null;

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
        ownerUserId: { in: workspaceUserIds },
      },
      select: { id: true, stock: true, warehouseLocation: true, name: true, sku: true },
    });

    if (!product) {
      return NextResponse.json({ detail: 'Product not found' }, { status: 404 });
    }

    const created = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      await ensureProductLocationStockRows(tx, product);
      const row = await tx.productLocationStock.findUniqueOrThrow({
        where: { productId_location: { productId: product.id, location } },
      });
      const available = Math.max(0, row.quantity - row.reserved);
      if (available < quantity) {
        throw new Error(`Only ${available} units available to reserve at ${location}`);
      }
      await tx.productLocationStock.update({
        where: { id: row.id },
        data: { reserved: row.reserved + quantity },
      });
      return tx.stockReservation.create({
        data: {
          ownerUserId: scope.userId,
          productId: product.id,
          orderId,
          location,
          quantity,
          status: 'active',
          expiresAt,
        },
      });
    });

    let orderNumber: string | undefined;
    const uuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (uuidLike) {
      const order = await prisma.order.findFirst({
        where: { id: orderId, ownerUserId: { in: workspaceUserIds } },
        select: { orderNumber: true },
      });
      if (order) orderNumber = order.orderNumber;
    }

    return NextResponse.json({
      id: created.id,
      product_id: created.productId,
      product_name: product.name,
      product_sku: product.sku,
      order_id: created.orderId,
      order_number: orderNumber,
      location: created.location,
      quantity: created.quantity,
      status: created.status,
      reserved_by: created.ownerUserId,
      reserved_at: created.reservedAt.toISOString(),
      expires_at: created.expiresAt?.toISOString(),
      created_at: created.createdAt.toISOString(),
      updated_at: created.updatedAt.toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('available to reserve')) {
      return NextResponse.json({ detail: msg }, { status: 400 });
    }
    if (isMissingInventoryTableError(e)) {
      return NextResponse.json({ detail: 'Run prisma migrate deploy.' }, { status: 503 });
    }
    return NextResponse.json({ detail: msg }, { status: 500 });
  }
}
