import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { orderLinesToApi, orderToApi } from '@/lib/db/api-serialize';
import { generateOrderNumber, resolveLinesFromPayload } from '@/lib/db/order-lines';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { logOperationalEvent } from '@/lib/comms/operational-events';
import { dispatchWorkflowTrigger } from '@/lib/workflows/workflow-engine';
import type { Prisma } from '@prisma/client';

const ORDER_LIST_INCLUDE = {
  customer: { select: { companyName: true } },
  _count: { select: { lineItems: true } },
} satisfies Prisma.OrderInclude;

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    const where: Prisma.OrderWhereInput = { ownerUserId: { in: workspaceUserIds } };
    if (search) {
      where.orderNumber = { contains: search, mode: 'insensitive' };
    }
    if (status) {
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: ORDER_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.order.count({ where }),
    ]);

    const items = rows.map((o) => {
      const { customer, _count, ...rest } = o;
      return orderToApi(rest, customer?.companyName, { itemCount: _count.lineItems });
    });

    return NextResponse.json({
      items,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const body = (await request.json()) as Record<string, unknown>;
    const customerId = String(body.customer_id ?? body.customerId ?? '').trim();
    if (!customerId) {
      return NextResponse.json({ detail: 'customer_id is required' }, { status: 400 });
    }

    const status = String(body.status ?? 'draft');
    const orderNumber =
      String(body.order_number ?? body.orderNumber ?? '').trim() || generateOrderNumber();

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

    const created = await prisma.order.create({
      data: {
        ownerUserId: scope.userId,
        customerId,
        orderNumber,
        status,
        total: totalWithTax,
        lineItems: {
          create: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          })),
        },
      },
      include: {
        customer: { select: { companyName: true, email: true } },
        lineItems: {
          include: { product: { select: { name: true } } },
        },
      },
    });

    await logOperationalEvent({
      ownerUserId: scope.userId,
      customerId,
      eventType: 'order',
      source: 'system',
      title: `Order ${orderNumber} created`,
      description: created.customer?.companyName ?? null,
      entityType: 'order',
      entityId: created.id,
      metadata: { status, total: totalWithTax },
    });

    void dispatchWorkflowTrigger('order_created', {
      ownerUserId: scope.userId,
      triggerEntityType: 'order',
      triggerEntityId: created.id,
      customerId,
      customerEmail: created.customer?.email ?? null,
      payload: { order_number: orderNumber, total: totalWithTax },
    });

    const { customer, lineItems, ...rest } = created;
    return NextResponse.json(
      orderToApi(rest, customer?.companyName, { lines: orderLinesToApi(lineItems) }),
      { status: 201 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes('Unknown or inactive product') ? 400 : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}
