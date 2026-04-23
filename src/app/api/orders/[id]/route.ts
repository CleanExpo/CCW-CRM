import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { orderLinesToApi, orderToApi } from '@/lib/db/api-serialize';
import { resolveLinesFromPayload } from '@/lib/db/order-lines';
import type { Prisma } from '@prisma/client';

export const ORDER_DETAIL_INCLUDE = {
  customer: { select: { companyName: true } },
  lineItems: {
    include: { product: { select: { name: true } } },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.OrderInclude;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const row = await prisma.order.findUnique({
      where: { id },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!row) {
      return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
    }
    const { customer, lineItems, ...rest } = row;
    return NextResponse.json(
      orderToApi(rest, customer?.companyName, { lines: orderLinesToApi(lineItems) })
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const hasItemsArray = 'items' in body && Array.isArray(body.items);

    if (!hasItemsArray) {
      const data: Prisma.OrderUpdateInput = {};
      if (body.status != null) data.status = String(body.status);
      if (body.customer_id != null || body.customerId != null) {
        data.customer = {
          connect: { id: String(body.customer_id ?? body.customerId) },
        };
      }
      const updated = await prisma.order.update({
        where: { id },
        data,
        include: ORDER_DETAIL_INCLUDE,
      });
      const { customer, lineItems, ...rest } = updated;
      if (lineItems.length > 0) {
        return NextResponse.json(
          orderToApi(rest, customer?.companyName, { lines: orderLinesToApi(lineItems) })
        );
      }
      return NextResponse.json(
        orderToApi(rest, customer?.companyName, { itemCount: 0 })
      );
    }

    const customerId = String(body.customer_id ?? body.customerId ?? existing.customerId).trim();
    const status = String(body.status ?? existing.status);

    const { lines, subtotal } = await resolveLinesFromPayload(body.items);
    if (lines.length === 0) {
      return NextResponse.json({ detail: 'At least one valid line item is required' }, { status: 400 });
    }

    const totalWithTax = subtotal * 1.1;

    const updated = await prisma.order.update({
      where: { id },
      data: {
        customerId,
        status,
        total: totalWithTax,
        lineItems: {
          deleteMany: {},
          create: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        },
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    const { customer, lineItems, ...rest } = updated;
    return NextResponse.json(
      orderToApi(rest, customer?.companyName, { lines: orderLinesToApi(lineItems) })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes('Unknown or inactive product') ? 400 : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
    }
    await prisma.order.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
