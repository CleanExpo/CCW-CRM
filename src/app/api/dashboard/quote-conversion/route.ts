import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const quotes = await prisma.quote.findMany({
      where: { ownerUserId: scope.userId },
      select: { status: true, total: true },
    });

    const total = quotes.length;
    const accepted = quotes.filter((q) => q.status === 'accepted').length;
    const rejected = quotes.filter((q) => q.status === 'rejected').length;
    const pending = quotes.filter((q) => ['draft', 'pending', 'sent'].includes(q.status)).length;
    const expired = quotes.filter((q) => q.status === 'expired').length;
    const convertedRevenue = quotes
      .filter((q) => q.status === 'accepted')
      .reduce((sum, q) => sum + Number(q.total || 0), 0);
    const avgValue =
      total > 0 ? quotes.reduce((sum, q) => sum + Number(q.total || 0), 0) / total : 0;

    return NextResponse.json({
      total_quotes: total,
      accepted,
      rejected,
      pending,
      expired,
      conversion_rate: total > 0 ? parseFloat(((accepted / total) * 100).toFixed(1)) : 0,
      average_quote_value: Math.round(avgValue),
      total_converted_revenue: convertedRevenue,
    });
  } catch {
    return NextResponse.json(
      {
        total_quotes: 0,
        accepted: 0,
        rejected: 0,
        pending: 0,
        expired: 0,
        conversion_rate: 0,
        average_quote_value: 0,
        total_converted_revenue: 0,
      },
      { status: 500 }
    );
  }
}
