import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { orderLinesToApi, orderToApi } from '@/lib/db/api-serialize';
import { generateOrderNumber, resolveLinesFromPayload } from '@/lib/db/order-lines';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
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
      select: { id: true, creditLimitAUD: true },
    });
    if (!customerRow) {
      return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
    }

    const { lines, subtotal } = await resolveLinesFromPayload(body.items, workspaceUserIds);
    if (lines.length === 0) {
      return NextResponse.json({ detail: 'At least one valid line item is required' }, { status: 400 });
    }

    const totalWithTax = subtotal * 1.1;

    // ── Credit limit gate ──────────────────────────────────────────────────────
    // Only enforced when a limit is explicitly set on the customer.
    const creditLimit = customerRow.creditLimitAUD != null ? Number(customerRow.creditLimitAUD) : null;
    if (creditLimit !== null) {
      // Sum outstanding (total − amountPaid) across non-draft, non-cancelled invoices.
      // We use DB amountPaid field (not re-summing InvoicePayment rows) to avoid the
      // empty-array seam documented in PROJECT-STATUS.md TASK-2.
      const outstandingAgg = await prisma.invoice.aggregate({
        where: {
          customerId,
          ownerUserId: { in: workspaceUserIds },
          status: { notIn: ['draft', 'cancelled', 'paid'] },
        },
        _sum: { total: true, amountPaid: true },
      });
      const outstanding =
        (outstandingAgg._sum.total ?? 0) - (outstandingAgg._sum.amountPaid ?? 0);

      if (outstanding + totalWithTax > creditLimit) {
        // Allow override if request body has managerOverride=true AND caller is ADMIN or MANAGER
        const managerOverride = body.managerOverride === true || body.manager_override === true;
        const isManager = scope.isAdmin || scope.role === 'admin' || scope.role === 'owner';
        if (!(managerOverride && isManager)) {
          return NextResponse.json(
            {
              code: 'CREDIT_LIMIT_EXCEEDED',
              outstanding: Math.round(outstanding * 100) / 100,
              limit: creditLimit,
              detail: `Credit limit of $${creditLimit.toFixed(2)} would be exceeded. Outstanding: $${outstanding.toFixed(2)}, new order: $${totalWithTax.toFixed(2)}.`,
            },
            { status: 402 }
          );
        }
      }
    }
    // ── End credit gate ───────────────────────────────────────────────────────

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
        customer: { select: { companyName: true } },
        lineItems: {
          include: { product: { select: { name: true } } },
        },
      },
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
