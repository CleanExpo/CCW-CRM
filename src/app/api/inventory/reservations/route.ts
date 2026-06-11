import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { expireDueStockReservations } from '@/lib/db/stock-reservation-helpers';
import { isMissingInventoryTableError } from '@/lib/db/inventory-api-helpers';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    await expireDueStockReservations(prisma, workspaceUserIds);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
    const status = searchParams.get('status')?.trim();
    const location = searchParams.get('location')?.trim();
    const search = searchParams.get('search')?.trim();

    const where: Prisma.StockReservationWhereInput = {
      product: { ownerUserId: { in: workspaceUserIds } },
    };

    if (status && status !== 'all') {
      where.status = status;
    }
    if (location && location !== 'all') {
      where.location = location;
    }
    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: 'insensitive' } },
        { product: { sku: { contains: search, mode: 'insensitive' } } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.stockReservation.findMany({
        where,
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockReservation.count({ where }),
    ]);

    const uuidLike = (s: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
    const orderIds = [...new Set(rows.map((r: typeof rows[number]) => r.orderId).filter(uuidLike))];
    const orders =
      orderIds.length > 0
        ? await prisma.order.findMany({
            where: { id: { in: orderIds }, ownerUserId: { in: workspaceUserIds } },
            select: { id: true, orderNumber: true },
          })
        : [];
    const orderById = new Map(orders.map((o: { id: string; orderNumber: string }) => [o.id, o.orderNumber]));

    return NextResponse.json({
      items: rows.map((r: typeof rows[number]) => ({
        id: r.id,
        product_id: r.productId,
        product_name: r.product.name,
        product_sku: r.product.sku,
        order_id: r.orderId,
        order_number: orderById.get(r.orderId),
        location: r.location,
        quantity: r.quantity,
        status: r.status,
        reserved_by: r.ownerUserId,
        reserved_at: r.reservedAt.toISOString(),
        expires_at: r.expiresAt?.toISOString(),
        fulfilled_at: r.fulfilledAt?.toISOString(),
        cancelled_at: r.cancelledAt?.toISOString(),
        created_at: r.createdAt.toISOString(),
        updated_at: r.updatedAt.toISOString(),
      })),
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
      });
    }
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
