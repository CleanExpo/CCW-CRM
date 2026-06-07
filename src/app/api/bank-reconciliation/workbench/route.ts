import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import type { FeedLineInput } from '@/lib/bank-reconciliation/matching-engine';
import {
  computeSuggestionsForFeed,
  refreshAllPendingSuggestions,
  serializeFeedForApi,
} from '@/lib/bank-reconciliation/match-suggestions';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const reviewOnly = searchParams.get('review_only') === 'true';

    await refreshAllPendingSuggestions(scope.userId, accountId ?? undefined);

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const feeds = await prisma.bankFeedTransaction.findMany({
      where: {
        reconciled: false,
        ...(reviewOnly ? { reviewStatus: 'flagged' } : { reviewStatus: null }),
        ...(accountId ? { bankAccountId: accountId } : {}),
        bankAccount: bankAccountOwnerFilter(ownerIds),
      },
      include: { bankAccount: true },
      orderBy: { transactionDate: 'desc' },
      take: 100,
    });

    const lines = await Promise.all(
      feeds.map(async (feed) => {
        const input: FeedLineInput = {
          id: feed.id,
          transaction_date: feed.transactionDate,
          description: feed.description,
          reference: feed.reference,
          credit: feed.credit,
          debit: feed.debit,
          raw_narration: feed.rawNarration,
        };
        const suggestions = await computeSuggestionsForFeed(input, scope.userId);
        return serializeFeedForApi(feed, feed.bankAccount.accountName, suggestions);
      })
    );

    return NextResponse.json({ lines, count: lines.length });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
