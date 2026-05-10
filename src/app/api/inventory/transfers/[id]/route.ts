import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const row = await prisma.stockTransfer.findFirst({
      where: {
        id,
        product: { ownerUserId: { in: workspaceUserIds } },
      },
      include: { product: { select: { name: true, sku: true } } },
    });

    if (!row) {
      return NextResponse.json({ detail: 'Transfer not found' }, { status: 404 });
    }

    return NextResponse.json(rowToApi(row));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
