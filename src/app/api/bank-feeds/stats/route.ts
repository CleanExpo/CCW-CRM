import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');

    const where = {
      bankAccount: { ownerUserId: scope.userId },
      ...(accountId ? { bankAccountId: accountId } : {}),
    };

    const [total, matched, unmatched] = await Promise.all([
      prisma.bankFeedTransaction.count({ where }),
      prisma.bankFeedTransaction.count({ where: { ...where, reconciled: true } }),
      prisma.bankFeedTransaction.count({ where: { ...where, reconciled: false } }),
    ]);

    const manual = 0;
    const rate = total > 0 ? Math.round((matched / total) * 1000) / 10 : 0;
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 86400000);

    return NextResponse.json({
      total_transactions: total,
      auto_matched: matched,
      manual_matched: manual,
      unmatched: unmatched,
      reconciliation_rate: rate,
      date_range: {
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
      },
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
