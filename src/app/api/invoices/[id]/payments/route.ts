import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { invoiceToApi, paymentToApi } from '@/lib/db/api-serialize';
import { deriveInvoiceStatus } from '@/lib/db/invoice-status';
import { prisma } from '@/lib/db/prisma';
import { assertManualPaymentMethodAllowed } from '@/lib/payments/offline-payment-methods';
import type { RecordPaymentRequest } from '@/types/invoices';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const body = (await request.json()) as RecordPaymentRequest;
    const amount = Number(body.amount);
    const paymentDate = body.payment_date ? new Date(body.payment_date) : new Date();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ detail: 'amount must be greater than 0' }, { status: 400 });
    }
    if (Number.isNaN(paymentDate.getTime())) {
      return NextResponse.json({ detail: 'Invalid payment_date' }, { status: 400 });
    }

    const methodCheck = assertManualPaymentMethodAllowed(String(body.payment_method ?? 'other'));
    if (!methodCheck.ok) {
      return NextResponse.json({ detail: methodCheck.detail }, { status: 400 });
    }
    const paymentMethod = methodCheck.method;
    const referenceNumber = body.reference_number?.trim() || null;
    if (
      !referenceNumber &&
      (paymentMethod === 'bank_transfer' || paymentMethod === 'eft' || paymentMethod === 'check')
    ) {
      return NextResponse.json(
        {
          detail:
            'reference_number is required for EFT, cheque, and bank transfer payments (audit trail).',
        },
        { status: 400 }
      );
    }

    const invoiceRow = await prisma.invoice.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
    });
    if (!invoiceRow) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }
    if (invoiceRow.status === 'cancelled') {
      return NextResponse.json(
        { detail: 'Cannot record payment on a cancelled invoice' },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoicePayment.create({
        data: {
          invoiceId: id,
          amount,
          paymentDate,
          paymentMethod,
          referenceNumber,
          notes: body.notes?.trim() || null,
          source: 'manual',
          createdByUserId: scope.userId,
        },
      });

      const sumPaid = await tx.invoicePayment.aggregate({
        where: { invoiceId: id },
        _sum: { amount: true },
      });
      const paid = sumPaid._sum.amount ?? 0;
      const amountDue = Math.max(0, invoiceRow.total - paid);

      let nextStatus = invoiceRow.status;
      if (amountDue <= 0.005) {
        nextStatus = 'paid';
      } else if (invoiceRow.status === 'draft') {
        nextStatus = 'sent';
      }

      return tx.invoice.update({
        where: { id },
        data: {
          amountPaid: paid,
          status: nextStatus,
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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { id } = await context.params;

    const invoiceRow = await prisma.invoice.findFirst({
      where: { id, ownerUserId: { in: workspaceUserIds } },
      include: { payments: { orderBy: { paymentDate: 'desc' } } },
    });
    if (!invoiceRow) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(invoiceRow.payments.map((p) => paymentToApi(p)));
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
