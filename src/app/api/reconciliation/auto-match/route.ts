import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthScope } from '@/lib/auth/data-scope';
import { applyBankMatch } from '@/lib/bank-reconciliation/apply-match';
import type { FeedLineInput, MatchTargetType } from '@/lib/bank-reconciliation/matching-engine';
import {
  computeSuggestionsForFeed,
  refreshFeedSuggestions,
} from '@/lib/bank-reconciliation/match-suggestions';
import { pickBestSuggestion } from '@/lib/bank-reconciliation/matching-engine';
import { bankAccountOwnerFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';
import { exportReconciledFeedToXero } from '@/lib/integrations/xero-reconciliation-export';

function mapTargetType(suggestedAction: string, targetType: MatchTargetType): Parameters<typeof applyBankMatch>[0]['targetType'] {
  if (targetType === 'invoice') return 'invoice';
  if (targetType === 'purchase_order') return 'purchase_order';
  if (targetType === 'pos_transaction') return 'pos_transaction';
  if (targetType === 'trade_finance_advance') return 'trade_finance_advance';
  if (suggestedAction.includes('transfer')) return 'transfer';
  if (suggestedAction.includes('fee')) return 'fee';
  if (targetType === 'rule') return 'rule';
  return 'transfer';
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireAuthScope(request);
    if (!scope) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = (await request.json()) as {
      transaction_id?: string;
      feed_id?: string;
      min_confidence?: number;
      account_id?: string;
      limit?: number;
    };

    const minConfidence = body.min_confidence ?? 0.9;
    const minScore = minConfidence <= 1 ? minConfidence * 100 : minConfidence;
    const ownerIds = await workspaceOwnerIds(scope.userId);

    if (body.transaction_id || body.feed_id) {
      const feedId = body.transaction_id ?? body.feed_id!;
      const feed = await prisma.bankFeedTransaction.findFirst({
        where: {
          id: feedId,
          reconciled: false,
          bankAccount: bankAccountOwnerFilter(ownerIds),
        },
      });
      if (!feed) {
        return NextResponse.json({ matched: false, reason: 'Transaction not found' }, { status: 404 });
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
      const best = pickBestSuggestion(suggestions);

      if (!best || best.confidence < minScore) {
        return NextResponse.json({
          matched: false,
          match_id: null,
          confidence: best ? best.confidence / 100 : 0,
          reason: best
            ? `Best match confidence ${best.confidence}% below threshold ${minScore}%`
            : 'No match suggestions found',
        });
      }

      await applyBankMatch({
        feedId: feed.id,
        userId: scope.userId,
        targetType: mapTargetType(best.suggested_action, best.target_type),
        targetId: best.target_id,
      });
      await exportReconciledFeedToXero({
        feedTransactionId: feed.id,
        performedBy: scope.userId,
      });

      return NextResponse.json({
        matched: true,
        match_id: best.target_id,
        feed_id: feed.id,
        confidence: best.confidence / 100,
        reason: best.match_reasons.join('; '),
        target_type: best.target_type,
        suggested_action: best.suggested_action,
      });
    }

    const feeds = await prisma.bankFeedTransaction.findMany({
      where: {
        reconciled: false,
        reviewStatus: null,
        ...(body.account_id ? { bankAccountId: body.account_id } : {}),
        bankAccount: bankAccountOwnerFilter(ownerIds),
      },
      take: Math.min(body.limit ?? 50, 100),
      orderBy: { transactionDate: 'desc' },
    });

    let matched = 0;
    let skipped = 0;
    const results: Array<{ feed_id: string; matched: boolean; confidence?: number; reason?: string }> = [];

    for (const feed of feeds) {
      const refreshed = await refreshFeedSuggestions(feed.id, scope.userId);
      const best = refreshed?.best;
      if (!best || best.confidence < minScore) {
        skipped++;
        results.push({
          feed_id: feed.id,
          matched: false,
          confidence: best ? best.confidence / 100 : 0,
          reason: 'Below confidence threshold',
        });
        continue;
      }

      try {
        await applyBankMatch({
          feedId: feed.id,
          userId: scope.userId,
          targetType: mapTargetType(best.suggested_action, best.target_type),
          targetId: best.target_id,
        });
        await exportReconciledFeedToXero({
          feedTransactionId: feed.id,
          performedBy: scope.userId,
        });
        matched++;
        results.push({
          feed_id: feed.id,
          matched: true,
          confidence: best.confidence / 100,
          reason: best.match_reasons.join('; '),
        });
      } catch {
        skipped++;
        results.push({ feed_id: feed.id, matched: false, reason: 'Apply match failed' });
      }
    }

    return NextResponse.json({ matched, skipped, results });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 500 });
  }
}
