import { prisma } from '@/lib/db/prisma';
import {
  buildInvoiceSuggestion,
  buildPosSuggestion,
  buildPurchaseOrderSuggestion,
  buildRuleSuggestion,
  buildTradeFinanceAdvanceSuggestion,
  pickBestSuggestion,
  serializeSuggestionSummary,
  type FeedLineInput,
  type MatchSuggestion,
} from '@/lib/bank-reconciliation/matching-engine';
import { bankAccountOwnerFilter, ownerDataFilter, workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';

export async function computeSuggestionsForFeed(
  feed: FeedLineInput,
  userId: string
): Promise<MatchSuggestion[]> {
  const ownerIds = await workspaceOwnerIds(userId);
  const amt =
    (feed.credit != null && feed.credit > 0 ? feed.credit : null) ??
    (feed.debit != null && feed.debit > 0 ? feed.debit : null) ??
    0;

  const [invoices, purchaseOrders, posRows, rules, advances] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        ...ownerDataFilter(ownerIds),
        status: { in: ['sent', 'overdue', 'partial'] },
      },
      include: { customer: true },
      take: 200,
    }),
    prisma.purchaseOrder.findMany({
      where: {
        ...ownerDataFilter(ownerIds),
        status: { in: ['approved', 'ordered', 'partial'] },
      },
      include: { supplier: true },
      take: 200,
    }),
    prisma.posTransaction.findMany({
      where: {
        ownerUserId: { in: ownerIds },
        reconciliationStatus: { not: 'reconciled' },
        amount: { gte: amt * 0.95, lte: amt * 1.05 },
      },
      take: 50,
    }),
    prisma.bankReconciliationRule.findMany({
      where: { ownerUserId: { in: ownerIds }, isActive: true },
    }),
    prisma.tradeFinanceAdvance.findMany({
      where: {
        ownerUserId: { in: ownerIds },
        status: { in: ['drawn', 'partial'] },
      },
      include: { supplier: { select: { companyName: true } } },
      take: 200,
    }),
  ]);

  const suggestions: MatchSuggestion[] = [];

  for (const inv of invoices) {
    const s = buildInvoiceSuggestion(feed, inv);
    if (s) suggestions.push(s);
  }
  for (const po of purchaseOrders) {
    const s = buildPurchaseOrderSuggestion(feed, po);
    if (s) suggestions.push(s);
  }
  for (const pos of posRows) {
    const s = buildPosSuggestion(feed, {
      id: pos.id,
      transactionNumber: pos.transactionNumber,
      total: pos.amount,
      transactionDate: pos.createdAt,
      paymentMethod: pos.paymentMethod,
    });
    if (s) suggestions.push(s);
  }
  for (const rule of rules) {
    const s = buildRuleSuggestion(feed, rule);
    if (s) suggestions.push(s);
  }
  for (const advance of advances) {
    const s = buildTradeFinanceAdvanceSuggestion(feed, advance);
    if (s) suggestions.push(s);
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

export async function refreshFeedSuggestions(feedId: string, userId: string) {
  const ownerIds = await workspaceOwnerIds(userId);
  const feed = await prisma.bankFeedTransaction.findFirst({
    where: {
      id: feedId,
      reconciled: false,
      bankAccount: bankAccountOwnerFilter(ownerIds),
    },
  });
  if (!feed) return null;

  const input: FeedLineInput = {
    id: feed.id,
    transaction_date: feed.transactionDate,
    description: feed.description,
    reference: feed.reference,
    credit: feed.credit,
    debit: feed.debit,
    raw_narration: feed.rawNarration,
  };

  const suggestions = await computeSuggestionsForFeed(input, userId);
  const best = pickBestSuggestion(suggestions);
  const summary = serializeSuggestionSummary(best);

  await prisma.bankFeedTransaction.update({
    where: { id: feed.id },
    data: {
      suggestedAction: summary.suggested_action,
      confidenceScore: summary.confidence_score,
      confidenceReason: summary.confidence_reason,
      gstCategory: summary.gst_category ?? undefined,
      accountCategory: summary.account_category ?? undefined,
      status: best ? 'suggested' : 'unmatched',
    },
  });

  return { feed_id: feed.id, suggestions, best };
}

export async function refreshAllPendingSuggestions(userId: string, accountId?: string) {
  const ownerIds = await workspaceOwnerIds(userId);
  const feeds = await prisma.bankFeedTransaction.findMany({
    where: {
      reconciled: false,
      reviewStatus: null,
      ...(accountId ? { bankAccountId: accountId } : {}),
      bankAccount: bankAccountOwnerFilter(ownerIds),
    },
    take: 100,
    orderBy: { transactionDate: 'desc' },
  });

  let updated = 0;
  for (const feed of feeds) {
    await refreshFeedSuggestions(feed.id, userId);
    updated++;
  }
  return updated;
}

export function feedAmountFromRow(feed: {
  credit: number | null;
  debit: number | null;
}): number {
  if (feed.credit != null && feed.credit > 0) return feed.credit;
  if (feed.debit != null && feed.debit > 0) return feed.debit;
  return Math.abs(feed.credit ?? feed.debit ?? 0);
}

export function serializeFeedForApi(
  feed: {
    id: string;
    bankAccountId: string;
    transactionDate: Date;
    description: string;
    rawNarration: string | null;
    reference: string;
    credit: number | null;
    debit: number | null;
    balance: number | null;
    reconciled: boolean;
    status: string;
    reviewStatus: string | null;
    suggestedAction: string | null;
    confidenceScore: number | null;
    confidenceReason: string | null;
    gstCategory: string | null;
    accountCategory: string | null;
    xeroExportStatus: string | null;
  },
  bankAccountName: string,
  suggestions: MatchSuggestion[] = []
) {
  return {
    feed_id: feed.id,
    bank_account_id: feed.bankAccountId,
    bank_account_name: bankAccountName,
    transaction_date: feed.transactionDate.toISOString(),
    description: feed.description,
    raw_narration: feed.rawNarration,
    reference: feed.reference,
    credit: feed.credit,
    debit: feed.debit,
    amount: feedAmountFromRow(feed),
    balance: feed.balance,
    reconciled: feed.reconciled,
    status: feed.status,
    review_status: feed.reviewStatus,
    suggested_action: feed.suggestedAction,
    confidence_score: feed.confidenceScore,
    confidence_reason: feed.confidenceReason,
    gst_category: feed.gstCategory,
    account_category: feed.accountCategory,
    xero_export_status: feed.xeroExportStatus,
    match_suggestions: suggestions.map((s) => ({
      target_type: s.target_type,
      target_id: s.target_id,
      label: s.label,
      amount: s.amount,
      date: s.date,
      confidence: s.confidence,
      match_reasons: s.match_reasons,
      suggested_action: s.suggested_action,
      pos_transaction_id: s.target_type === 'pos_transaction' ? s.target_id : undefined,
      transaction_number: s.target_type === 'pos_transaction' ? s.label : undefined,
      payment_method: s.target_type === 'pos_transaction' ? 'card' : undefined,
    })),
  };
}
