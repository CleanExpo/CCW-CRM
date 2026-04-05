import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getTerminals,
  createTerminal,
  updateTerminal,
  deleteTerminal,
  getTransactions,
  getTransaction,
  createTransaction,
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getUnreconciledFeeds,
  getReconciliationAlerts,
  syncBankFeeds,
  reconcileTransaction,
  bulkReconcile,
  createBulkXeroInvoices,
} from '@/lib/api/pos';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Locations ─────────────────────────────────
describe('POS Locations', () => {
  it('getLocations calls GET /api/pos/locations', async () => {
    mockGet.mockResolvedValue([]);
    await getLocations();
    expect(mockGet).toHaveBeenCalledWith('/api/pos/locations');
  });

  it('createLocation calls POST /api/pos/locations', async () => {
    mockPost.mockResolvedValue({ id: 'loc-1' });
    await createLocation({ name: 'Store 1' } as never);
    expect(mockPost).toHaveBeenCalledWith('/api/pos/locations', { name: 'Store 1' });
  });

  it('updateLocation calls PUT /api/pos/locations/:id', async () => {
    mockPut.mockResolvedValue({ id: 'loc-1' });
    await updateLocation('loc-1', { name: 'Updated' } as never);
    expect(mockPut).toHaveBeenCalledWith('/api/pos/locations/loc-1', { name: 'Updated' });
  });

  it('deleteLocation calls DELETE /api/pos/locations/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await deleteLocation('loc-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/pos/locations/loc-1');
  });
});

// ─── Staff ─────────────────────────────────────
describe('POS Staff', () => {
  it('getStaff calls GET /api/pos/staff', async () => {
    mockGet.mockResolvedValue([]);
    await getStaff();
    expect(mockGet).toHaveBeenCalledWith('/api/pos/staff');
  });

  it('createStaff calls POST /api/pos/staff', async () => {
    mockPost.mockResolvedValue({ id: 'staff-1' });
    await createStaff({ name: 'Alice' } as never);
    expect(mockPost).toHaveBeenCalledWith('/api/pos/staff', { name: 'Alice' });
  });

  it('deleteStaff calls DELETE /api/pos/staff/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await deleteStaff('staff-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/pos/staff/staff-1');
  });
});

// ─── Terminals ────────────────────────────────
describe('POS Terminals', () => {
  it('getTerminals calls GET /api/pos/terminals with no location', async () => {
    mockGet.mockResolvedValue([]);
    await getTerminals();
    expect(mockGet).toHaveBeenCalledWith('/api/pos/terminals');
  });

  it('getTerminals appends location_id when provided', async () => {
    mockGet.mockResolvedValue([]);
    await getTerminals('loc-1');
    expect(mockGet).toHaveBeenCalledWith('/api/pos/terminals?location_id=loc-1');
  });

  it('createTerminal calls POST /api/pos/terminals', async () => {
    mockPost.mockResolvedValue({ id: 'term-1' });
    const data = {
      terminal_code: 'T-001',
      location_id: 'loc-1',
      terminal_type: 'physical' as const,
      is_active: true,
    };
    await createTerminal(data);
    expect(mockPost).toHaveBeenCalledWith('/api/pos/terminals', data);
  });
});

// ─── Transactions ────────────────────────────
describe('POS Transactions', () => {
  it('getTransactions calls GET /api/pos/transactions with no filters', async () => {
    mockGet.mockResolvedValue([]);
    await getTransactions();
    expect(mockGet).toHaveBeenCalledWith('/api/pos/transactions');
  });

  it('getTransactions appends filters', async () => {
    mockGet.mockResolvedValue([]);
    await getTransactions({ location_code: 'SYD', start_date: '2026-01-01' });
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('location_code=SYD');
    expect(url).toContain('start_date=2026-01-01');
  });

  it('getTransaction calls GET /api/pos/transactions/:id', async () => {
    mockGet.mockResolvedValue({ id: 'txn-1' });
    await getTransaction('txn-1');
    expect(mockGet).toHaveBeenCalledWith('/api/pos/transactions/txn-1');
  });

  it('createTransaction calls POST /api/pos/transactions', async () => {
    mockPost.mockResolvedValue({ id: 'txn-1' });
    const data = { items: [], payment_method: 'cash' };
    await createTransaction(data as never);
    expect(mockPost).toHaveBeenCalledWith('/api/pos/transactions', data);
  });
});

// ─── Bank Accounts ───────────────────────────
describe('Bank Accounts', () => {
  it('getBankAccounts calls GET /api/bank-feeds/accounts', async () => {
    mockGet.mockResolvedValue([]);
    await getBankAccounts();
    expect(mockGet).toHaveBeenCalledWith('/api/bank-feeds/accounts');
  });

  it('createBankAccount calls POST /api/bank-feeds/accounts', async () => {
    mockPost.mockResolvedValue({ id: 'acc-1' });
    const data = {
      account_name: 'Test',
      account_number: '123',
      bsb: '000-000',
      bank_name: 'CBA',
      account_type: 'checking' as const,
      feed_provider: 'manual' as const,
      is_active: true,
    };
    await createBankAccount(data);
    expect(mockPost).toHaveBeenCalledWith('/api/bank-feeds/accounts', data);
  });

  it('deleteBankAccount calls DELETE /api/bank-feeds/accounts/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await deleteBankAccount('acc-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/bank-feeds/accounts/acc-1');
  });
});

// ─── Reconciliation ──────────────────────────
describe('Reconciliation', () => {
  it('getUnreconciledFeeds calls GET /api/bank-feeds/unreconciled', async () => {
    mockGet.mockResolvedValue([]);
    await getUnreconciledFeeds();
    expect(mockGet).toHaveBeenCalledWith('/api/bank-feeds/unreconciled');
  });

  it('syncBankFeeds calls POST /api/bank-feeds/sync', async () => {
    mockPost.mockResolvedValue({ synced_count: 5 });
    await syncBankFeeds('acc-1');
    expect(mockPost).toHaveBeenCalledWith('/api/bank-feeds/sync', { account_id: 'acc-1' });
  });

  it('reconcileTransaction calls POST /api/bank-feeds/reconcile', async () => {
    mockPost.mockResolvedValue({ success: true });
    await reconcileTransaction('feed-1', 'txn-1');
    expect(mockPost).toHaveBeenCalledWith('/api/bank-feeds/reconcile', {
      bank_feed_id: 'feed-1',
      pos_transaction_id: 'txn-1',
    });
  });

  it('bulkReconcile calls POST /api/bank-feeds/bulk-reconcile', async () => {
    mockPost.mockResolvedValue({ success: true, matched_count: 3, failed_count: 0, errors: [] });
    const matches = [{ bank_feed_id: 'f1', pos_transaction_id: 't1' }];
    await bulkReconcile(matches);
    expect(mockPost).toHaveBeenCalledWith('/api/bank-feeds/bulk-reconcile', { matches });
  });
});

// ─── Xero ────────────────────────────────────
describe('POS Xero Integration', () => {
  it('createBulkXeroInvoices calls POST /api/pos/xero/bulk-invoices', async () => {
    mockPost.mockResolvedValue({ success: true, created_count: 2 });
    await createBulkXeroInvoices(['txn-1', 'txn-2']);
    expect(mockPost).toHaveBeenCalledWith('/api/pos/xero/bulk-invoices', {
      transaction_ids: ['txn-1', 'txn-2'],
    });
  });
});
