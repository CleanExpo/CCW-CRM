import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceMemberUserIds } from '@/lib/auth/workspace-scope';
import { parseInvoiceReportPeriod } from '@/lib/db/invoice-report-period';

function aud(n: number): string {
  return n.toFixed(2);
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });

    const workspaceUserIds = await getWorkspaceMemberUserIds(scope.userId);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const range = parseInvoiceReportPeriod(period);
    if (!range) {
      return NextResponse.json({ detail: 'Invalid or missing period (use yyyy-MM or yyyy-Qn)' }, { status: 400 });
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        ownerUserId: { in: workspaceUserIds },
        status: { not: 'cancelled' },
        invoiceDate: { gte: range.start, lte: range.end },
      },
      select: {
        id: true,
        subtotal: true,
        taxTotal: true,
        total: true,
      },
    });

    const taxable_sales = invoices.reduce((s: number, i: { subtotal: number }) => s + i.subtotal, 0);
    const label_1a_gst_collected = invoices.reduce((s: number, i: { taxTotal: number }) => s + i.taxTotal, 0);
    const total_sales_incl_gst = invoices.reduce((s: number, i: { total: number }) => s + i.total, 0);
    const label_1b_gst_credits = 0;
    const label_net_gst_payable = label_1a_gst_collected - label_1b_gst_credits;

    return NextResponse.json({
      period,
      date_from: range.start.toISOString().split('T')[0],
      date_to: range.end.toISOString().split('T')[0],
      label_1a_gst_collected: aud(label_1a_gst_collected),
      label_1b_gst_credits: aud(label_1b_gst_credits),
      label_net_gst_payable: aud(label_net_gst_payable),
      taxable_sales: aud(taxable_sales),
      export_sales: aud(0),
      total_sales_incl_gst: aud(total_sales_incl_gst),
      invoice_count: invoices.length,
      note:
        'Figures are calculated from invoice lines in CCW (GST on sales). Purchases / GST credits (1B) are not tracked here â€” enter those from your accounting system.',
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
