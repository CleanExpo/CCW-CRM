import { apiClient } from '@/lib/api/client';

export interface BankFeedEntry {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference: string | null;
  credit: number | null;
  debit: number | null;
  balance: number | null;
}

export interface BankAccount {
  id: string;
  account_name: string;
  account_number: string; // last 4 digits only
  bank_name: string;
  location_code: string | null;
  feed_provider: string | null;
  last_feed_sync_at: string | null;
}

export interface ReconciliationStats {
  total_transactions: number;
  auto_matched: number;
  manual_matched: number;
  unmatched: number;
  reconciliation_rate: number;
  date_range: {
    start_date: string;
    end_date: string;
  };
}

export interface ReconciliationAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affected_count: number;
  total_amount: number;
  details: Record<string, unknown>;
  created_at: string;
}

export interface BankFeedSyncResponse {
  transactions_synced: number;
  provider: string;
  start_date: string;
  end_date: string;
}

export async function listUnreconciledFeeds(params?: {
  account_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<BankFeedEntry[]> {
  const query = new URLSearchParams();
  if (params?.account_id) query.set('account_id', params.account_id);
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  const qs = query.toString();
  return apiClient.get<BankFeedEntry[]>(`/api/bank-feeds/unreconciled${qs ? `?${qs}` : ''}`);
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  return apiClient.get<BankAccount[]>('/api/bank-feeds/accounts');
}

export async function getReconciliationStats(params?: {
  account_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<ReconciliationStats> {
  const query = new URLSearchParams();
  if (params?.account_id) query.set('account_id', params.account_id);
  if (params?.start_date) query.set('start_date', params.start_date);
  if (params?.end_date) query.set('end_date', params.end_date);
  const qs = query.toString();
  return apiClient.get<ReconciliationStats>(`/api/bank-feeds/stats${qs ? `?${qs}` : ''}`);
}

export async function getReconciliationAlerts(params?: {
  account_id?: string;
}): Promise<ReconciliationAlert[]> {
  const query = new URLSearchParams();
  if (params?.account_id) query.set('account_id', params.account_id);
  const qs = query.toString();
  return apiClient.get<ReconciliationAlert[]>(`/api/bank-feeds/alerts${qs ? `?${qs}` : ''}`);
}

export async function syncBankFeeds(params?: {
  account_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<BankFeedSyncResponse> {
  return apiClient.post<BankFeedSyncResponse>('/api/bank-feeds/sync', {
    account_id: params?.account_id ?? null,
    start_date: params?.start_date ?? null,
    end_date: params?.end_date ?? null,
  });
}

export async function reconcileFeed(
  feed_id: string,
  pos_transaction_id: string
): Promise<{ feed_id: string; pos_transaction_id: string; status: string }> {
  return apiClient.post('/api/bank-feeds/reconcile', { feed_id, pos_transaction_id });
}
