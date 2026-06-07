import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { nextInvoiceNumber } from '@/lib/db/invoice-mutations';
import { invoiceToApi } from '@/lib/db/api-serialize';
import { deriveInvoiceStatus } from '@/lib/db/invoice-status';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const scope = await requireAuthScope(_request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { orderId } = await context.params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, ownerUserId: { in: workspaceUserIds } },
      include: {
        lineItems: { include: { product: { select: { name: true } } } },
        invoices: { select: { id: true } },
      },
    });

    if (!order) return NextResponse.json({ detail: 'Order not found' }, { status: 404 });

    const allowedStatuses = ['confirmed', 'delivered', 'processing', 'shipped'];
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json(
        { detail: `Order status must be one of: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    if (order.invoices.length > 0) {
      return NextResponse.json(
        { detail: 'An invoice already exists for this order' },
        { status: 400 }
      );
    }

    if (order.lineItems.length === 0) {
      return NextResponse.json({ detail: 'Order has no line items' }, { status: 400 });
    }

    const invoiceDate = new Date();
    const dueDate = new Date(Date.now() + 30 * 86400000);
    const taxRate = 10;

    const lines = order.lineItems.map((li) => {
      const lineSubtotal = li.lineTotal;
      const taxAmount = lineSubtotal * (taxRate / 100);
      return {
        productId: li.productId,
        description: li.product?.name ?? 'Order line item',
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        taxRate,
        taxAmount,
        lineSubtotal,
        lineTotal: lineSubtotal + taxAmount,
      };
    });

    const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    const taxTotal = lines.reduce((s, l) => s + l.taxAmount, 0);
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);
    const invoiceNumber = await nextInvoiceNumber(scope.userId);

    const created = await prisma.invoice.create({
      data: {
        ownerUserId: scope.userId,
        invoiceNumber,
        customerId: order.customerId,
        orderId: order.id,
        invoiceDate,
        dueDate,
        status: 'draft',
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
