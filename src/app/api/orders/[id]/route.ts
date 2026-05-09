import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { orderLinesToApi, orderToApi } from '@/lib/db/api-serialize';
import { resolveLinesFromPayload } from '@/lib/db/order-lines';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
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
    const scope = await requireAuthScope(_request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const row = await prisma.order.findFirst({
      where: { id, ownerUserId: scope.userId },
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
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const { id } = await context.params;
    const existing = await prisma.order.findFirst({ where: { id, ownerUserId: scope.userId } });
    if (!existing) {
      return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const hasItemsArray = 'items' in body && Array.isArray(body.items);

    if (!hasItemsArray) {
      const data: Prisma.OrderUpdateInput = {};
      if (body.status != null) data.status = String(body.status);
      if (body.customer_id != null || body.customerId != null) {
        const targetCustomerId = String(body.customer_id ?? body.customerId);
        const targetCustomer = await prisma.customer.findFirst({
          where: { id: targetCustomerId, ownerUserId: { in: workspaceUserIds }, isActive: true },
          select: { id: true },
        });
        if (!targetCustomer) {
          return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
        }
        data.customer = {
          connect: { id: targetCustomerId },
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

    const customerRow = await prisma.customer.findFirst({
      where: { id: customerId, ownerUserId: { in: workspaceUserIds }, isActive: true },
      select: { id: true },
    });
    if (!customerRow) {
      return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
    }

    const { lines, subtotal } = await resolveLinesFromPayload(body.items, workspaceUserIds);
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
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const { id } = await context.params;
    const existing = await prisma.order.findFirst({
      where: { id, ownerUserId: scope.userId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
    }
    await prisma.order.deleteMany({ where: { id, ownerUserId: scope.userId } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
