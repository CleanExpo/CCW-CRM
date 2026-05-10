import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { invoiceSummaryToApi, invoiceToApi } from '@/lib/db/api-serialize';
import { deriveInvoiceStatus } from '@/lib/db/invoice-status';
import { nextInvoiceNumber, resolveInvoiceLinesFromPayload } from '@/lib/db/invoice-mutations';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import type { Prisma } from '@prisma/client';
import type { CreateInvoiceRequest } from '@/types/invoices';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50', 10)));
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status')?.trim();
    const customerId = searchParams.get('customer_id')?.trim();

    const where: Prisma.InvoiceWhereInput = {
      ownerUserId: { in: workspaceUserIds },
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { customer: { companyName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { companyName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
      data: rows.map((r) =>
        invoiceSummaryToApi({
          ...r,
          status: deriveInvoiceStatus(r),
        })
      ),
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
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

    const body = (await request.json()) as CreateInvoiceRequest;
    const customerId = String(body.customer_id ?? '').trim();
    if (!customerId) {
      return NextResponse.json({ detail: 'customer_id is required' }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, ownerUserId: scope.userId, isActive: true },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
    }

    const items = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ detail: 'At least one line item is required' }, { status: 400 });
    }

    let orderId: string | null = null;
    const rawOrderId = body.order_id?.trim();
    if (rawOrderId) {
      const order = await prisma.order.findFirst({
        where: { id: rawOrderId, ownerUserId: scope.userId },
        select: { id: true },
      });
      if (!order) {
        return NextResponse.json({ detail: 'Order not found' }, { status: 400 });
      }
      orderId = order.id;
    }

    const invoiceDate = new Date(body.invoice_date);
    const dueDate = new Date(body.due_date);
    if (Number.isNaN(invoiceDate.getTime()) || Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ detail: 'Invalid invoice_date or due_date' }, { status: 400 });
    }

    let lines;
    try {
      lines = await resolveInvoiceLinesFromPayload(items, workspaceUserIds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ detail: msg }, { status: 400 });
    }

    const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    const taxTotal = lines.reduce((s, l) => s + l.taxAmount, 0);
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);
    const invoiceNumber = await nextInvoiceNumber(scope.userId);

    const created = await prisma.invoice.create({
      data: {
        ownerUserId: scope.userId,
        invoiceNumber,
        customerId,
        orderId,
        invoiceDate,
        dueDate,
        status: 'draft',
        notes: body.notes?.trim() || null,
        subtotal,
        taxTotal,
        total,
        amountPaid: 0,
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            taxRate: l.taxRate,
            taxAmount: l.taxAmount,
            lineSubtotal: l.lineSubtotal,
            lineTotal: l.lineTotal,
          })),
        },
      },
      include: {
        customer: { select: { companyName: true, email: true } },
        items: { include: { product: true } },
        payments: true,
      },
    });

    return NextResponse.json(
      invoiceToApi(created, { statusOverride: deriveInvoiceStatus(created) }),
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
