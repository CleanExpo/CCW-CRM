import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import type { Prisma } from '@prisma/client';

function rowToApi(row: {
  id: string;
  ownerUserId: string;
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
}) {
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
    initiated_by: row.ownerUserId,
    initiated_at: row.createdAt.toISOString(),
    completed_by: row.status === 'completed' ? row.ownerUserId : undefined,
    completed_at: completedAt,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
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
    const status = searchParams.get('status')?.trim();
    const productId = searchParams.get('product_id')?.trim();
    const fromLocation = searchParams.get('from_location')?.trim();
    const toLocation = searchParams.get('to_location')?.trim();

    const where: Prisma.StockTransferWhereInput = {
      product: { ownerUserId: { in: workspaceUserIds } },
    };
    if (status) where.status = status;
    if (productId) where.productId = productId;
    if (fromLocation) where.fromLocation = fromLocation;
    if (toLocation) where.toLocation = toLocation;

    const [rows, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(rowToApi),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
