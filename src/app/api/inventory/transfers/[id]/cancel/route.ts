import { NextRequest, NextResponse } from 'next/server';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { cancelTransfer } from '@/lib/db/transfer-cancel-service';

/**
 * POST /api/inventory/transfers/:id/cancel
 *
 * Cancel a pending or in-transit stock transfer and roll back any stock movement.
 *
 * Rollback rules (enforced in transfer-cancel-service):
 *  - pending    → set cancelled; no stock adjustment (stock never moved)
 *  - in_transit → restore stock to fromLocation, decrement toLocation, set cancelled
 *  - completed  → 409 rejected; stock already moved, create a reverse transfer instead
 *  - cancelled  → 409 rejected (idempotency guard)
 *
 * Org scoping mirrors neighbouring endpoints: workspace member user-id guard on
 * the owning product — identical to GET /api/inventory/transfers/:id.
 */
export async function POST(
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

    const result = await cancelTransfer({ id, workspaceUserIds });

    if (!result.ok) {
      return NextResponse.json({ detail: result.detail }, { status: result.status });
    }

    const { transfer } = result;
    return NextResponse.json({
      id: transfer.id,
      status: transfer.status,
      product_id: transfer.productId,
      product_name: transfer.productName,
      product_sku: transfer.productSku,
      from_location: transfer.fromLocation,
      to_location: transfer.toLocation,
      quantity: transfer.quantity,
      reason: transfer.reason ?? undefined,
      notes: transfer.notes ?? undefined,
      updated_at: transfer.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error('[POST /api/inventory/transfers/:id/cancel]', e);
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
