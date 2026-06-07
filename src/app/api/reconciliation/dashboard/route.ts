import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { feedAmountFromRow } from '@/lib/bank-reconciliation/match-suggestions';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const accountFilter = { bankAccount: bankAccountOwnerFilter(ownerIds) };

    const [pending, matched, withSuggestions, matchedToday, lastSync] = await Promise.all([
      prisma.bankFeedTransaction.count({ where: { reconciled: false, ...accountFilter } }),
      prisma.bankFeedTransaction.count({ where: { reconciled: true, ...accountFilter } }),
      prisma.bankFeedTransaction.count({
        where: { reconciled: false, confidenceScore: { gte: 50 }, ...accountFilter },
      }),
      prisma.bankFeedTransaction.count({
        where: {
          reconciled: true,
          reconciledAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          ...accountFilter,
        },
      }),
      prisma.bankAccount.findFirst({
        where: bankAccountOwnerFilter(ownerIds),
        orderBy: { lastFeedSyncAt: 'desc' },
        select: { lastFeedSyncAt: true },
      }),
    ]);

    const pendingRows = await prisma.bankFeedTransaction.findMany({
      where: { reconciled: false, ...accountFilter },
      select: { credit: true, debit: true },
    });
    const pending_amount = pendingRows.reduce((sum, r) => sum + feedAmountFromRow(r), 0);
    const total = pending + matched;
    const auto_match_rate = total > 0 ? Math.round((matched / total) * 100) : 0;

    return NextResponse.json({
      total_pending: pending,
      total_matched: matched,
      total_with_suggestions: withSuggestions,
      auto_match_rate,
      pending_amount,
      matched_today: matchedToday,
      last_sync_at: lastSync?.lastFeedSyncAt?.toISOString() ?? null,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
