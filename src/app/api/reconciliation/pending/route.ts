import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import type { FeedLineInput } from '@/lib/bank-reconciliation/matching-engine';
import {
  computeSuggestionsForFeed,
  feedAmountFromRow,
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
    const withSuggestionsOnly = searchParams.get('with_suggestions_only') === 'true';
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100);

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const feeds = await prisma.bankFeedTransaction.findMany({
      where: {
        reconciled: false,
        reviewStatus: null,
        bankAccount: bankAccountOwnerFilter(ownerIds),
        ...(withSuggestionsOnly ? { confidenceScore: { gte: 50 } } : {}),
      },
      include: { bankAccount: true },
      orderBy: { transactionDate: 'desc' },
      take: limit,
    });

    const results = await Promise.all(
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
        const serialized = serializeFeedForApi(feed, feed.bankAccount.accountName, suggestions);
        return {
          feed_id: serialized.feed_id,
          transaction_date: serialized.transaction_date,
          description: serialized.description,
          reference: serialized.reference,
          amount: serialized.amount,
          bank_account_name: serialized.bank_account_name,
          match_suggestions: serialized.match_suggestions.map((s) => ({
            pos_transaction_id: s.pos_transaction_id ?? s.target_id,
            transaction_number: s.transaction_number ?? s.label,
            amount: s.amount,
            date: s.date,
            payment_method: s.payment_method ?? s.target_type,
            confidence: s.confidence,
            match_reasons: s.match_reasons,
            target_type: s.target_type,
            target_id: s.target_id,
            suggested_action: s.suggested_action,
          })),
          created_at: feed.createdAt.toISOString(),
        };
      })
    );

    if (withSuggestionsOnly) {
      return NextResponse.json(results.filter((r) => r.match_suggestions.length > 0));
    }

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
