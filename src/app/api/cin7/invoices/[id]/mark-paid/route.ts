import { requireAuthScope } from '@/lib/auth/data-scope';
import { prisma } from '@/lib/db/prisma';
import { assertManualPaymentMethodAllowed } from '@/lib/payments/offline-payment-methods';
import { NextRequest, NextResponse } from 'next/server';

function rowToApi(inv: {
  id: string;
  cin7OrderMappingId: string;
  cin7InvoiceId: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  amount: number;
  currency: string;
  status: string;
  paidAt: Date | null;
  orderReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: inv.id,
    cin7_order_mapping_id: inv.cin7OrderMappingId,
    cin7_invoice_id: inv.cin7InvoiceId,
    invoice_number: inv.invoiceNumber,
    invoice_date: inv.invoiceDate?.toISOString().split('T')[0] ?? null,
    due_date: inv.dueDate?.toISOString().split('T')[0] ?? null,
    amount: String(inv.amount),
    currency: inv.currency,
    status: inv.status,
    paid_at: inv.paidAt?.toISOString() ?? null,
    order_reference: inv.orderReference,
    created_at: inv.createdAt.toISOString(),
    updated_at: inv.updatedAt.toISOString(),
  };
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as {
      amount?: number;
      paid_at?: string | null;
      payment_method?: string | null;
      reference?: string | null;
    };

    const methodCheck = assertManualPaymentMethodAllowed(
      String(body.payment_method ?? 'bank_transfer')
    );
    if (!methodCheck.ok) {
      return NextResponse.json({ detail: methodCheck.detail }, { status: 400 });
    }
    const reference = body.reference?.trim() || null;
    if (!reference) {
      return NextResponse.json(
        {
          detail:
            'reference is required when marking a sales invoice paid offline (EFT/cash/cheque audit trail). Card payments must come from Stripe webhooks.',
        },
        { status: 400 }
      );
    }

    const paidAt = body.paid_at ? new Date(body.paid_at) : new Date();

    const existing = await prisma.salesInvoice.findFirst({
      where: { id, ownerUserId: scope.userId },
    });
    if (!existing) {
      return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    }

    const row = await prisma.$transaction(async (tx) => {
      const inv = await tx.salesInvoice.update({
        where: { id },
        data: {
          status: 'paid',
          paidAt,
        },
      });

      await tx.salesPayment.create({
        data: {
          salesInvoiceId: inv.id,
          cin7InvoiceId: inv.cin7InvoiceId,
          cin7PaymentId: `PAY-${Date.now()}`,
          paymentMethod: methodCheck.method,
          amount: body.amount ?? inv.amount,
          currency: inv.currency,
          paymentDate: paidAt,
          reference,
          status: 'completed',
          source: 'manual',
          createdByUserId: scope.userId,
        },
      });

      return inv;
    });

    return NextResponse.json(rowToApi(row));
  } catch {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }
}
