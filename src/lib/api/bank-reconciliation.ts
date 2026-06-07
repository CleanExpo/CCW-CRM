import { apiClient } from '@/lib/api/client';

export type WorkbenchLine = {
  feed_id: string;
  bank_account_id: string;
  bank_account_name: string;
  transaction_date: string;
  description: string;
  raw_narration: string | null;
  reference: string;
  credit: number | null;
  debit: number | null;
  amount: number;
  balance: number | null;
  status: string;
  review_status: string | null;
  suggested_action: string | null;
  confidence_score: number | null;
  confidence_reason: string | null;
  gst_category: string | null;
  account_category: string | null;
  match_suggestions: Array<{
    target_type: string;
    target_id: string;
    label: string;
    amount: number;
    confidence: number;
    match_reasons: string[];
    suggested_action: string;
  }>;
};

export async function getReconciliationWorkbench(accountId?: string): Promise<{
  lines: WorkbenchLine[];
  count: number;
}> {
  const qs = accountId ? `?account_id=${accountId}` : '';
  return apiClient.get(`/api/bank-reconciliation/workbench${qs}`);
}

export async function approveBankMatch(input: {
  feed_id: string;
  target_type: string;
  target_id?: string;
  notes?: string;
}) {
  return apiClient.post('/api/bank-reconciliation/match', input);
}

export async function splitBankMatch(input: {
  feed_id: string;
  allocations: Array<{
    allocation_type: string;
    target_id?: string;
    amount: number;
    gst_category?: string;
    account_code?: string;
    notes?: string;
  }>;
}) {
  return apiClient.post('/api/bank-reconciliation/split', input);
}

export async function flagBankFeedForReview(feed_id: string, reason?: string) {
  return apiClient.post('/api/bank-reconciliation/review', { feed_id, reason });
}

export async function createReconciliationRule(input: {
  name: string;
  match_pattern: string;
  match_field?: string;
  action_type: string;
  account_code?: string;
  gst_category?: string;
}) {
  return apiClient.post('/api/bank-reconciliation/rules', input);
}

export async function importCdrCsv(account_id: string, file: File) {
  const form = new FormData();
  form.append('account_id', account_id);
  form.append('file', file);
  const res = await fetch('/api/bank-feeds/import', { method: 'POST', body: form, credentials: 'include' });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail ?? 'Import failed');
  }
  return res.json() as Promise<{ imported: number; skipped: number }>;
}

export function confidenceBandLabel(score: number | null): string {
  if (score == null) return 'No match';
  if (score >= 95) return 'One-click approve';
  if (score >= 80) return 'Strong suggestion';
  if (score >= 50) return 'Possible match';
  return 'Review required';
}

export async function getReconciliationAudit(feedId: string) {
  return apiClient.get<
    Array<{
      id: string;
      action: string;
      performed_by: string;
      details: Record<string, unknown>;
      created_at: string;
    }>
  >(`/api/bank-reconciliation/audit/${feedId}`);
}

export function confidenceBandClass(score: number | null): string {
  if (score == null || score < 50) return 'bg-muted text-muted-foreground';
  if (score >= 95) return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-100';
  if (score >= 80) return 'bg-sky-500/15 text-sky-900 dark:text-sky-100';
  return 'bg-amber-500/15 text-amber-900 dark:text-amber-100';
}
