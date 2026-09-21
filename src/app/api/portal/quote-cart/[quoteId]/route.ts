import { NextRequest, NextResponse } from 'next/server';
import { withPortalOrdering } from '@/lib/portal/ordering-route';
import { getQuoteCart, orderQuote } from '@/lib/portal/my-price';

type Ctx = { params: Promise<{ quoteId: string }> };

/** UNI-2747: the quote-to-cart link. Only the quote's own customer can open it. */
export async function GET(request: NextRequest, context: Ctx) {
  return withPortalOrdering(request, async (customerId) => {
    const { quoteId } = await context.params;
    return NextResponse.json(await getQuoteCart(customerId, quoteId));
  });
}

export async function POST(request: NextRequest, context: Ctx) {
  return withPortalOrdering(request, async (customerId) => {
    const { quoteId } = await context.params;
    const { order, unavailable } = await orderQuote(customerId, quoteId);
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
