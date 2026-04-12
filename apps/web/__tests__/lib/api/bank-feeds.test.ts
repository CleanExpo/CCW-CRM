import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import {
  listUnreconciledFeeds,
  listBankAccounts,
  getReconciliationStats,
  getReconciliationAlerts,
  syncBankFeeds,
  reconcileFeed,
} from '@/lib/api/bank-feeds';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listUnreconciledFeeds', () => {
  it('calls /api/bank-feeds/unreconciled with no params', async () => {
    mockGet.mockResolvedValue([]);
    await listUnreconciledFeeds();
    expect(mockGet).toHaveBeenCalledWith('/api/bank-feeds/unreconciled');
  });

  it('appends query params when provided', async () => {
    mockGet.mockResolvedValue([]);
    await listUnreconciledFeeds({
      account_id: 'acc-1',
      start_date: '2026-01-01',
      end_date: '2026-01-31',
    });
    expect(mockGet).toHaveBeenCalledWith(
      '/api/bank-feeds/unreconciled?account_id=acc-1&start_date=2026-01-01&end_date=2026-01-31'
    );
  });
});

describe('listBankAccounts', () => {
  it('calls /api/bank-feeds/accounts', async () => {
    mockGet.mockResolvedValue([]);
    await listBankAccounts();
    expect(mockGet).toHaveBeenCalledWith('/api/bank-feeds/accounts');
  });
});

describe('getReconciliationStats', () => {
  it('calls stats endpoint with no params', async () => {
    mockGet.mockResolvedValue({ total_transactions: 0 });
    await getReconciliationStats();
    expect(mockGet).toHaveBeenCalledWith('/api/bank-feeds/stats');
  });

  it('appends account_id when provided', async () => {
    mockGet.mockResolvedValue({ total_transactions: 10 });
    await getReconciliationStats({ account_id: 'acc-1' });
    expect(mockGet).toHaveBeenCalledWith('/api/bank-feeds/stats?account_id=acc-1');
  });
});

describe('getReconciliationAlerts', () => {
  it('calls alerts endpoint with no params', async () => {
    mockGet.mockResolvedValue([]);
    await getReconciliationAlerts();
    expect(mockGet).toHaveBeenCalledWith('/api/bank-feeds/alerts');
  });

  it('appends account_id when provided', async () => {
    mockGet.mockResolvedValue([]);
    await getReconciliationAlerts({ account_id: 'acc-1' });
    expect(mockGet).toHaveBeenCalledWith('/api/bank-feeds/alerts?account_id=acc-1');
  });
});

describe('syncBankFeeds', () => {
  it('posts to sync with null defaults when no params', async () => {
    mockPost.mockResolvedValue({ transactions_synced: 0, provider: 'demo' });
    await syncBankFeeds();
    expect(mockPost).toHaveBeenCalledWith('/api/bank-feeds/sync', {
      account_id: null,
      start_date: null,
      end_date: null,
    });
  });

  it('sends provided params', async () => {
    mockPost.mockResolvedValue({ transactions_synced: 5, provider: 'live' });
    await syncBankFeeds({ account_id: 'acc-1', start_date: '2026-01-01', end_date: '2026-01-31' });
    expect(mockPost).toHaveBeenCalledWith('/api/bank-feeds/sync', {
      account_id: 'acc-1',
      start_date: '2026-01-01',
      end_date: '2026-01-31',
    });
  });
});

describe('reconcileFeed', () => {
  it('posts feed_id and pos_transaction_id to /api/bank-feeds/reconcile', async () => {
    mockPost.mockResolvedValue({ feed_id: 'f-1', pos_transaction_id: 'p-1', status: 'matched' });
    const result = await reconcileFeed('f-1', 'p-1');
    expect(mockPost).toHaveBeenCalledWith('/api/bank-feeds/reconcile', {
      feed_id: 'f-1',
      pos_transaction_id: 'p-1',
    });
    expect(result.status).toBe('matched');
  });
});
