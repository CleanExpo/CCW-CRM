import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { parseDateQuery } from '@/lib/db/invoice-report-period';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const dateFrom = parseDateQuery(searchParams.get('date_from'));
    const dateTo = parseDateQuery(searchParams.get('date_to'));

    const dateFilter =
      dateFrom || dateTo
        ? {
            invoiceDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {};

    const invoices = await prisma.invoice.findMany({
      where: {
        ownerUserId: { in: workspaceUserIds },
        status: { not: 'cancelled' },
        ...dateFilter,
      },
      select: {
        total: true,
        amountPaid: true,
        dueDate: true,
        status: true,
      },
    });

    const total_revenue = invoices.reduce((s, i) => s + i.total, 0);
    const total_outstanding = invoices.reduce((s, i) => s + Math.max(0, i.total - i.amountPaid), 0);

    let total_overdue = 0;
    let overdue_invoice_count = 0;
    let paid_invoice_count = 0;

    for (const inv of invoices) {
      const due = Math.max(0, inv.total - inv.amountPaid);
      if (due <= 0.005) {
        paid_invoice_count++;
        continue;
      }
      const endDue = new Date(inv.dueDate);
      endDue.setHours(23, 59, 59, 999);
      if (Date.now() > endDue.getTime()) {
        total_overdue += due;
        overdue_invoice_count++;
      }
    }

    return NextResponse.json({
      total_revenue,
      total_outstanding,
      total_overdue,
      invoice_count: invoices.length,
      paid_invoice_count,
      overdue_invoice_count,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
