import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      amount?: number;
      paid_at?: string | null;
      payment_method?: string | null;
    };

    const paidAt = body.paid_at ? new Date(body.paid_at) : new Date();

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
          paymentMethod: body.payment_method ?? 'card',
          amount: body.amount ?? inv.amount,
          currency: inv.currency,
          paymentDate: paidAt,
          reference: inv.invoiceNumber,
          status: 'completed',
        },
      });

      return inv;
    });

    return NextResponse.json(rowToApi(row));
  } catch {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  }
}
