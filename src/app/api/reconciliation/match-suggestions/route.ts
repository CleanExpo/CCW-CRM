import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import type { FeedLineInput } from '@/lib/bank-reconciliation/matching-engine';
import { computeSuggestionsForFeed } from '@/lib/bank-reconciliation/match-suggestions';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function GET(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transaction_id') ?? searchParams.get('feed_id');
    if (!transactionId) {
      return NextResponse.json({ detail: 'transaction_id is required' }, { status: 400 });
    }

    const ownerIds = await workspaceOwnerIds(scope.userId);
    const feed = await prisma.bankFeedTransaction.findFirst({
      where: {
        id: transactionId,
        reconciled: false,
        bankAccount: bankAccountOwnerFilter(ownerIds),
      },
    });
    if (!feed) {
      return NextResponse.json({ detail: 'Transaction not found' }, { status: 404 });
    }

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

    return NextResponse.json(
      suggestions.map((s) => ({
        target_type: s.target_type,
        target_id: s.target_id,
        label: s.label,
        amount: s.amount,
        date: s.date,
        confidence: s.confidence / 100,
        confidence_score: s.confidence,
        match_reasons: s.match_reasons,
        suggested_action: s.suggested_action,
        gst_category: s.gst_category ?? null,
        account_category: s.account_category ?? null,
      }))
    );
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
