import { NextRequest, NextResponse } from 'next/server';
import { withPortalOrdering } from '@/lib/portal/ordering-route';
import { orderAgain } from '@/lib/portal/my-price';

/** UNI-2747: repeat a past order (or some lines) as a draft at today's price. Body: { line_ids? }. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withPortalOrdering(request, async (customerId) => {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const lineIds = Array.isArray(body.line_ids) ? body.line_ids.map(String) : undefined;
    const { order, unavailable } = await orderAgain(customerId, id, lineIds);
    return NextResponse.json(
      {
        order_id: order.id,
        order_number: order.orderNumber,
        status: order.status,
        total: order.total,
        unavailable_product_ids: unavailable,
      },
      { status: 201 }
    );
  });
}
