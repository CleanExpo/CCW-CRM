import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { orderLinesToApi, orderToApi } from '@/lib/db/api-serialize';
import type { Prisma } from '@prisma/client';

const INCLUDE = {
  customer: { select: { companyName: true } },
  lineItems: {
    include: { product: { select: { name: true } } },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.OrderInclude;

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const statusFromQuery = searchParams.get('status');

    let status = statusFromQuery;
    if (!status) {
      try {
        const body = (await request.json()) as { status?: string };
        status = body.status ?? null;
      } catch {
        /* empty body */
      }
    }

    if (!status) {
      return NextResponse.json({ detail: 'status is required' }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ detail: 'Order not found' }, { status: 404 });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: INCLUDE,
    });

    const { customer, lineItems, ...rest } = updated;
    return NextResponse.json(
      orderToApi(rest, customer?.companyName, {
        lines: lineItems.length ? orderLinesToApi(lineItems) : undefined,
        itemCount: lineItems.length,
      })
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
