import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { invoiceToApi } from '@/lib/db/api-serialize';
import { deriveInvoiceStatus } from '@/lib/db/invoice-status';
import { resolveInvoiceLinesFromPayload } from '@/lib/db/invoice-mutations';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import type { UpdateInvoiceRequest } from '@/types/invoices';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const row = await prisma.invoice.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      include: {
        customer: { select: { companyName: true, email: true } },
        items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    if (!row) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    const status = deriveInvoiceStatus(row);
    return NextResponse.json(invoiceToApi(row, { statusOverride: status }));
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

    const existing = await prisma.invoice.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    if (existing.status !== 'draft') {
      return NextResponse.json({ detail: 'Only draft invoices can be edited' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateInvoiceRequest;

    const customerId = String(body.customer_id ?? existing.customerId).trim();
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, ownerUserId: { in: workspaceUserIds }, isActive: true },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json({ detail: 'Customer not found' }, { status: 404 });
    }

    const invoiceDate = body.invoice_date
      ? new Date(body.invoice_date)
      : existing.invoiceDate;
    const dueDate = body.due_date ? new Date(body.due_date) : existing.dueDate;
    if (Number.isNaN(invoiceDate.getTime()) || Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ detail: 'Invalid invoice_date or due_date' }, { status: 400 });
    }

    let lines;
    if (body.items && body.items.length > 0) {
      try {
        lines = await resolveInvoiceLinesFromPayload(body.items, workspaceUserIds);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ detail: msg }, { status: 400 });
      }
    } else {
      return NextResponse.json({ detail: 'items are required to update a draft invoice' }, { status: 400 });
    }

    const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
    const taxTotal = lines.reduce((s, l) => s + l.taxAmount, 0);
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);

    const updated = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });

      return tx.invoice.update({
        where: { id },
        data: {
          customerId,
          invoiceDate,
          dueDate,
          notes: body.notes?.trim() ?? existing.notes,
          subtotal,
          taxTotal,
          total,
          amountPaid: existing.amountPaid,
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
          items: { include: { product: true }, orderBy: { createdAt: 'asc' } },
          payments: { orderBy: { paymentDate: 'desc' } },
        },
      });
    });

    const status = deriveInvoiceStatus(updated);
    return NextResponse.json(invoiceToApi(updated, { statusOverride: status }));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const existing = await prisma.invoice.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    if (existing.status !== 'draft') {
      return NextResponse.json({ detail: 'Only draft invoices can be deleted' }, { status: 400 });
    }

    await prisma.invoice.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
