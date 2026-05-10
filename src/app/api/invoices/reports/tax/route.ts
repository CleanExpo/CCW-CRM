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

    const lines = await prisma.invoiceLineItem.findMany({
      where: {
        invoice: {
          ownerUserId: { in: workspaceUserIds },
          status: { not: 'cancelled' },
          ...(dateFrom || dateTo
            ? {
                invoiceDate: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              }
            : {}),
        },
      },
      select: {
        taxRate: true,
        taxAmount: true,
        lineSubtotal: true,
        invoiceId: true,
      },
    });

    const byRate = new Map<
      number,
      { total_tax: number; taxable_amount: number; invoiceIds: Set<string> }
    >();

    for (const li of lines) {
      const rate = Math.round(li.taxRate * 100) / 100;
      const cur = byRate.get(rate) ?? {
        total_tax: 0,
        taxable_amount: 0,
        invoiceIds: new Set<string>(),
      };
      cur.total_tax += li.taxAmount;
      cur.taxable_amount += li.lineSubtotal;
      cur.invoiceIds.add(li.invoiceId);
      byRate.set(rate, cur);
    }

    const tax_by_rate = [...byRate.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([tax_rate, v]) => ({
        tax_rate,
        total_tax: v.total_tax,
        taxable_amount: v.taxable_amount,
        invoice_count: v.invoiceIds.size,
      }));

    const total_tax_collected = tax_by_rate.reduce((s, r) => s + r.total_tax, 0);

    return NextResponse.json({
      total_tax_collected,
      tax_by_rate,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
