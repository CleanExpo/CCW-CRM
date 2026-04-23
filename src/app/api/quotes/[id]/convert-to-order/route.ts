import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { nextOrderNumber } from '@/lib/db/quote-mutations';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!quote) return NextResponse.json({ detail: 'Quote not found' }, { status: 404 });
    if (quote.status.toLowerCase() !== 'accepted') {
      return NextResponse.json(
        { detail: 'Only accepted quotes can be converted to an order' },
        { status: 400 }
      );
    }
    if (quote.lineItems.length === 0) {
      return NextResponse.json({ detail: 'Quote has no line items' }, { status: 400 });
    }

    const orderNumber = await nextOrderNumber();
    const total = quote.lineItems.reduce((s, li) => s + li.lineTotal, 0);

    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          customerId: quote.customerId,
          orderNumber,
          status: 'processing',
          total,
          lineItems: {
            create: quote.lineItems.map((li) => ({
              productId: li.productId,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              lineTotal: li.lineTotal,
            })),
          },
        },
      });
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: 'converted' },
      });
      return o;
    });

    return NextResponse.json({ order_number: order.orderNumber, order_id: order.id });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
