export type MatchTargetType =
  | 'invoice'
  | 'purchase_order'
  | 'pos_transaction'
  | 'trade_finance_advance'
  | 'transfer'
  | 'fee'
  | 'rule';

export type MatchSuggestion = {
  target_type: MatchTargetType;
  target_id: string;
  label: string;
  amount: number;
  date: string;
  confidence: number;
  match_reasons: string[];
  suggested_action: string;
  gst_category?: string | null;
  account_category?: string | null;
};

export type FeedLineInput = {
  id: string;
  transaction_date: Date;
  description: string;
  reference: string;
  credit: number | null;
  debit: number | null;
  raw_narration?: string | null;
};

function feedAmount(feed: FeedLineInput): number {
  if (feed.credit != null && feed.credit > 0) return feed.credit;
  if (feed.debit != null && feed.debit > 0) return feed.debit;
  return Math.abs(feed.credit ?? feed.debit ?? 0);
}

function daysApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function textContains(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return normalizeText(haystack).includes(normalizeText(needle));
}

function amountScore(feedAmt: number, targetAmt: number): { score: number; reason?: string } {
  const diff = Math.abs(feedAmt - targetAmt);
  if (diff < 0.01) return { score: 40, reason: 'Exact amount match' };
  if (diff <= 1) return { score: 30, reason: 'Amount within $1' };
  if (diff / Math.max(targetAmt, 1) <= 0.02) return { score: 20, reason: 'Amount within 2%' };
  return { score: 0 };
}

function dateScore(feedDate: Date, targetDate: Date): { score: number; reason?: string } {
  const days = daysApart(feedDate, targetDate);
  if (days <= 1) return { score: 20, reason: 'Same-day transaction' };
  if (days <= 3) return { score: 15, reason: 'Within 3 days' };
  if (days <= 7) return { score: 10, reason: 'Within 7 days' };
  if (days <= 14) return { score: 5, reason: 'Within 14 days' };
  return { score: 0 };
}

export function confidenceBand(score: number): 'auto' | 'strong' | 'possible' | 'none' {
  if (score >= 95) return 'auto';
  if (score >= 80) return 'strong';
  if (score >= 50) return 'possible';
  return 'none';
}

export function buildInvoiceSuggestion(
  feed: FeedLineInput,
  invoice: {
    id: string;
    invoiceNumber: string;
    total: number;
    amountPaid: number;
    dueDate: Date;
    invoiceDate: Date;
    customer: { companyName: string; contactName: string | null };
  }
): MatchSuggestion | null {
  const outstanding = Math.max(invoice.total - invoice.amountPaid, 0);
  if (outstanding <= 0) return null;

  const amt = feedAmount(feed);
  let score = 0;
  const reasons: string[] = [];

  const amtPart = amountScore(amt, outstanding);
  score += amtPart.score;
  if (amtPart.reason) reasons.push(amtPart.reason);

  const datePart = dateScore(feed.transaction_date, invoice.dueDate);
  score += datePart.score;
  if (datePart.reason) reasons.push(datePart.reason);

  const haystack = `${feed.description} ${feed.reference} ${feed.raw_narration ?? ''}`;
  if (textContains(haystack, invoice.invoiceNumber)) {
    score += 25;
    reasons.push('Invoice number in bank reference');
  }
  if (textContains(haystack, invoice.customer.companyName)) {
    score += 15;
    reasons.push('Customer name in narration');
  } else if (invoice.customer.contactName && textContains(haystack, invoice.customer.contactName)) {
    score += 10;
    reasons.push('Contact name in narration');
  }

  if (score < 50) return null;

  return {
    target_type: 'invoice',
    target_id: invoice.id,
    label: `Invoice ${invoice.invoiceNumber} — ${invoice.customer.companyName}`,
    amount: outstanding,
    date: invoice.dueDate.toISOString(),
    confidence: Math.min(score, 100),
    match_reasons: reasons,
    suggested_action: 'match_invoice',
    gst_category: 'GST on income',
    account_category: 'Accounts Receivable',
  };
}

export function buildPurchaseOrderSuggestion(
  feed: FeedLineInput,
  po: {
    id: string;
    poNumber: string;
    total: number;
    orderDate: Date;
    supplier: { companyName: string };
  }
): MatchSuggestion | null {
  const amt = feedAmount(feed);
  if (feed.debit == null && feed.credit != null) return null;

  let score = 0;
  const reasons: string[] = [];

  const amtPart = amountScore(amt, po.total);
  score += amtPart.score;
  if (amtPart.reason) reasons.push(amtPart.reason);

  const datePart = dateScore(feed.transaction_date, po.orderDate);
  score += datePart.score;
  if (datePart.reason) reasons.push(datePart.reason);

  const haystack = `${feed.description} ${feed.reference} ${feed.raw_narration ?? ''}`;
  if (textContains(haystack, po.poNumber)) {
    score += 25;
    reasons.push('PO number in bank reference');
  }
  if (textContains(haystack, po.supplier.companyName)) {
    score += 15;
    reasons.push('Supplier name in narration');
  }

  if (score < 50) return null;

  return {
    target_type: 'purchase_order',
    target_id: po.id,
    label: `PO ${po.poNumber} — ${po.supplier.companyName}`,
    amount: po.total,
    date: po.orderDate.toISOString(),
    confidence: Math.min(score, 100),
    match_reasons: reasons,
    suggested_action: 'match_bill',
    gst_category: 'GST on expenses',
    account_category: 'Accounts Payable',
  };
}

export function buildPosSuggestion(
  feed: FeedLineInput,
  pos: {
    id: string;
    transactionNumber: string;
    total: number;
    transactionDate: Date;
    paymentMethod: string;
  }
): MatchSuggestion | null {
  const amt = feedAmount(feed);
  let score = 0;
  const reasons: string[] = [];

  const amtPart = amountScore(amt, pos.total);
  score += amtPart.score;
  if (amtPart.reason) reasons.push(amtPart.reason);

  const datePart = dateScore(feed.transaction_date, pos.transactionDate);
  score += datePart.score;
  if (datePart.reason) reasons.push(datePart.reason);

  if (textContains(feed.description, pos.transactionNumber)) {
    score += 20;
    reasons.push('POS transaction number in narration');
  }

  if (score < 50) return null;

  return {
    target_type: 'pos_transaction',
    target_id: pos.id,
    label: `POS ${pos.transactionNumber} (${pos.paymentMethod})`,
    amount: pos.total,
    date: pos.transactionDate.toISOString(),
    confidence: Math.min(score, 100),
    match_reasons: reasons,
    suggested_action: 'match_pos',
  };
}

export function buildTradeFinanceAdvanceSuggestion(
  feed: FeedLineInput,
  advance: {
    id: string;
    advanceNumber: string;
    principalAmount: number;
    fees: number;
    interest: number;
    repaidAmount: number;
    maturityDate: Date;
    drawdownDate: Date;
    securityRef: string | null;
    supplier: { companyName: string } | null;
  }
): MatchSuggestion | null {
  const outstanding =
    advance.principalAmount + advance.fees + advance.interest - advance.repaidAmount;
  if (outstanding <= 0) return null;

  const amt = feedAmount(feed);
  if (feed.debit == null && feed.credit != null) return null;

  let score = 0;
  const reasons: string[] = [];

  const amtPart = amountScore(amt, outstanding);
  score += amtPart.score;
  if (amtPart.reason) reasons.push(amtPart.reason);

  const datePart = dateScore(feed.transaction_date, advance.maturityDate);
  score += datePart.score;
  if (datePart.reason) reasons.push(datePart.reason);

  const haystack = `${feed.description} ${feed.reference} ${feed.raw_narration ?? ''}`;
  if (textContains(haystack, advance.advanceNumber)) {
    score += 25;
    reasons.push('Advance number in bank reference');
  }
  if (advance.securityRef && textContains(haystack, advance.securityRef)) {
    score += 20;
    reasons.push('Security reference in narration');
  }
  if (advance.supplier && textContains(haystack, advance.supplier.companyName)) {
    score += 15;
    reasons.push('Supplier name in narration');
  }

  if (score < 50) return null;

  return {
    target_type: 'trade_finance_advance',
    target_id: advance.id,
    label: `Trade finance ${advance.advanceNumber}${advance.supplier ? ` — ${advance.supplier.companyName}` : ''}`,
    amount: outstanding,
    date: advance.maturityDate.toISOString(),
    confidence: Math.min(score, 100),
    match_reasons: reasons,
    suggested_action: 'match_trade_finance_advance',
    gst_category: 'GST-free',
    account_category: 'Trade Finance',
  };
}

export function buildRuleSuggestion(
  feed: FeedLineInput,
  rule: {
    id: string;
    name: string;
    matchPattern: string;
    matchField: string;
    actionType: string;
    accountCode: string | null;
    gstCategory: string | null;
  }
): MatchSuggestion | null {
  const fieldValue =
    rule.matchField === 'reference'
      ? feed.reference
      : rule.matchField === 'raw_narration'
        ? feed.raw_narration ?? feed.description
        : feed.description;

  if (!textContains(fieldValue, rule.matchPattern)) return null;

  return {
    target_type: 'rule',
    target_id: rule.id,
    label: rule.name,
    amount: feedAmount(feed),
    date: feed.transaction_date.toISOString(),
    confidence: 92,
    match_reasons: [`Matches rule "${rule.name}"`],
    suggested_action: rule.actionType,
    gst_category: rule.gstCategory,
    account_category: rule.accountCode,
  };
}

export function pickBestSuggestion(suggestions: MatchSuggestion[]): MatchSuggestion | null {
  if (suggestions.length === 0) return null;
  return suggestions.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
}

export function serializeSuggestionSummary(suggestion: MatchSuggestion | null) {
  if (!suggestion) {
    return {
      suggested_action: null,
      confidence_score: null,
      confidence_reason: null,
      confidence_band: 'none' as const,
    };
  }
  return {
    suggested_action: suggestion.suggested_action,
    confidence_score: suggestion.confidence,
    confidence_reason: suggestion.match_reasons.join('; '),
    confidence_band: confidenceBand(suggestion.confidence),
    gst_category: suggestion.gst_category ?? null,
    account_category: suggestion.account_category ?? null,
  };
}
