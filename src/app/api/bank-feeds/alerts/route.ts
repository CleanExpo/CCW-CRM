import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');

    const where = accountId ? { bankAccountId: accountId, reconciled: false } : { reconciled: false };
    const unmatched = await prisma.bankFeedTransaction.count({ where });
    const rows = await prisma.bankFeedTransaction.findMany({
      where,
      take: 200,
    });
    const totalAmount = rows.reduce((s, r) => s + (r.credit ?? 0), 0);

    const alerts: Array<{
      type: string;
      severity: 'info' | 'warning' | 'critical';
      title: string;
      description: string;
      affected_count: number;
      total_amount: number;
      details: Record<string, unknown>;
      created_at: string;
    }> = [];

    if (unmatched > 0) {
      alerts.push({
        type: 'unmatched_deposits',
        severity: unmatched > 10 ? 'warning' : 'info',
        title: 'Unreconciled bank lines',
        description: `${unmatched} feed line(s) are not matched to POS settlements.`,
        affected_count: unmatched,
        total_amount: Math.round(totalAmount * 100) / 100,
        details: { account_id: accountId },
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(alerts);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
