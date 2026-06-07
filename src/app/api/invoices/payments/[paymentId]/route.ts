import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { invoiceToApi } from '@/lib/db/api-serialize';
import { deriveInvoiceStatus } from '@/lib/db/invoice-status';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { paymentId } = await context.params;

    const payment = await prisma.invoicePayment.findUnique({
      where: { id: paymentId },
      include: { invoice: true },
    });

    if (!payment || !workspaceUserIds.includes(payment.invoice.ownerUserId)) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoicePayment.delete({ where: { id: paymentId } });

      const sumPaid = await tx.invoicePayment.aggregate({
        where: { invoiceId: payment.invoiceId },
        _sum: { amount: true },
      });
      const paid = sumPaid._sum.amount ?? 0;
      const amountDue = Math.max(0, payment.invoice.total - paid);

      let nextStatus = payment.invoice.status;
      if (payment.invoice.status === 'cancelled') {
        nextStatus = 'cancelled';
      } else if (amountDue <= 0.005) {
        nextStatus = 'paid';
      } else if (payment.invoice.status === 'draft') {
        nextStatus = 'draft';
      } else {
        nextStatus = 'sent';
      }

      return tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { amountPaid: paid, status: nextStatus },
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
