import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

function rowToApi(p: {
  id: string;
  salesInvoiceId: string | null;
  cin7InvoiceId: string | null;
  cin7PaymentId: string | null;
  paymentMethod: string | null;
  amount: number;
  currency: string;
  paymentDate: Date | null;
  reference: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    id: p.id,
    cin7_invoice_id: p.cin7InvoiceId,
    cin7_payment_id: p.cin7PaymentId,
    payment_method: p.paymentMethod,
    amount: String(p.amount),
    currency: p.currency,
    payment_date: p.paymentDate?.toISOString().split('T')[0] ?? null,
    reference: p.reference,
    status: p.status,
    created_at: p.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');

    const where = { invoice: { ownerUserId: scope.userId } };

    const [rows, total] = await Promise.all([
      prisma.salesPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salesPayment.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(rowToApi),
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize) || 1,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
