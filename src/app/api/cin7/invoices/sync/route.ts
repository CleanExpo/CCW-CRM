import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const uid = scope.userId;
    const orders = await prisma.order.findMany({
      where: { ownerUserId: uid },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    let synced = 0;
    for (const o of orders) {
      const mappingId = o.id;
      const exists = await prisma.salesInvoice.findFirst({
        where: { cin7OrderMappingId: mappingId, ownerUserId: uid },
      });
      if (exists) continue;

      await prisma.salesInvoice.create({
        data: {
          ownerUserId: uid,
          cin7OrderMappingId: mappingId,
          cin7InvoiceId: `INV-${o.orderNumber}`,
          invoiceNumber: o.orderNumber,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 14 * 86400000),
          amount: o.total,
          currency: 'AUD',
          status: 'draft',
          orderReference: o.orderNumber,
        },
      });
      synced++;
    }

    return NextResponse.json({
      synced,
      message:
        synced > 0
          ? `Created ${synced} invoice draft(s) from orders.`
          : 'No new invoices to create (all recent orders already have invoices).',
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
