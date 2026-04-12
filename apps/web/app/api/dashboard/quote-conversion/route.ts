import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: quotes } = await supabase.from('quotes').select('status, total');

    const total = quotes?.length ?? 0;
    const accepted = quotes?.filter((q) => q.status === 'accepted').length ?? 0;
    const rejected = quotes?.filter((q) => q.status === 'rejected').length ?? 0;
    const pending =
      quotes?.filter((q) => ['draft', 'pending', 'sent'].includes(q.status)).length ?? 0;
    const expired = quotes?.filter((q) => q.status === 'expired').length ?? 0;
    const convertedRevenue =
      quotes
        ?.filter((q) => q.status === 'accepted')
        .reduce((sum, q) => sum + Number(q.total || 0), 0) ?? 0;
    const avgValue =
      total > 0 ? quotes!.reduce((sum, q) => sum + Number(q.total || 0), 0) / total : 0;

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
