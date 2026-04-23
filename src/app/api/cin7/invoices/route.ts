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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '20');
    const status = searchParams.get('status');

    const where = status ? { status } : {};

    const [rows, total] = await Promise.all([
      prisma.salesInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.salesInvoice.count({ where }),
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
