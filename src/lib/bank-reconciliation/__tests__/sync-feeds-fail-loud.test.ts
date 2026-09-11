/**
 * UNI-2668 Phase 0c — money-path silent-success elimination.
 *
 * Before the fix in this branch, any bank account whose `feedProvider` was
 * neither a CDR provider nor 'manual' fell into an else-branch that used
 * `Math.random()` to invent one to three bank transactions — with fabricated
 * amounts and a "Customer payment — demo feed" description — and wrote them
 * into the production `bankFeedTransaction` table, then reported
 * `transactions_synced: n` as though a real feed had been polled.
 *
 * These tests pin that an unsupported provider writes nothing and says so.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAccountFindFirst = vi.fn();
const mockAccountUpdate = vi.fn();
const mockFeedCreate = vi.fn();
const mockFetchCdr = vi.fn();
const mockIsCdrProvider = vi.fn();
const mockRefreshSuggestions = vi.fn();
const mockWorkspaceOwnerIds = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    bankAccount: { findFirst: mockAccountFindFirst, update: mockAccountUpdate },
    bankFeedTransaction: { create: mockFeedCreate },
  },
}));
vi.mock('@/lib/integrations/cdr-bank-feed', () => ({
  fetchCdrBankTransactions: mockFetchCdr,
  isCdrFeedProvider: mockIsCdrProvider,
}));
vi.mock('@/lib/bank-reconciliation/match-suggestions', () => ({
  refreshFeedSuggestions: mockRefreshSuggestions,
}));
vi.mock('@/lib/bank-reconciliation/scope', () => ({
  workspaceOwnerIds: mockWorkspaceOwnerIds,
  bankAccountOwnerFilter: () => ({}),
}));

const { syncBankAccountFeeds } = await import('../sync-feeds');

const INPUT = { userId: 'user-1', accountId: 'acct-1' };

function accountWithProvider(feedProvider: string) {
  return {
    id: 'acct-1',
    accountName: 'Business Cheque',
    accountNumber: '12345678',
    bsb: '084-000',
    cdrAccountId: null,
    feedProvider,
    isActive: true,
  };
}

describe('syncBankAccountFeeds with an unsupported feed provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceOwnerIds.mockResolvedValue(['user-1']);
    mockIsCdrProvider.mockReturnValue(false);
    mockAccountFindFirst.mockResolvedValue(accountWithProvider('some-unwired-provider'));
  });

  it('creates no bank feed transactions at all', async () => {
    await syncBankAccountFeeds(INPUT);
    expect(mockFeedCreate).not.toHaveBeenCalled();
  });

  it('reports zero transactions synced rather than an invented count', async () => {
    const result = await syncBankAccountFeeds(INPUT);
    expect(result.ok).toBe(true);
    expect(result.body.transactions_synced).toBe(0);
  });

  it('names the provider as having no automated sync', async () => {
    const result = await syncBankAccountFeeds(INPUT);
    expect(result.body.message).toMatch(/no automated sync|not supported|unsupported/i);
  });

  it('never describes anything as a demo feed', async () => {
    const result = await syncBankAccountFeeds(INPUT);
    expect(JSON.stringify(result.body)).not.toMatch(/demo feed/i);
  });
});

describe('syncBankAccountFeeds leaves the supported paths alone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceOwnerIds.mockResolvedValue(['user-1']);
  });

  it('manual accounts keep their existing guidance message and write nothing', async () => {
    mockIsCdrProvider.mockReturnValue(false);
    mockAccountFindFirst.mockResolvedValue(accountWithProvider('manual'));
    const result = await syncBankAccountFeeds(INPUT);
    expect(mockFeedCreate).not.toHaveBeenCalled();
    expect(result.body.message).toMatch(/Manual account/i);
  });

  it('CDR accounts still write the rows the CDR client returned', async () => {
    mockIsCdrProvider.mockReturnValue(true);
    mockAccountFindFirst.mockResolvedValue(accountWithProvider('cdr'));
    mockFetchCdr.mockResolvedValue({
      provider: 'cdr',
      mode: 'live',
      message: 'ok',
      rows: [
        {
          transaction_date: new Date('2026-09-01'),
          description: 'Real inbound payment',
          raw_narration: 'Real inbound payment',
          reference: 'REF-1',
          credit: 100,
          debit: null,
          balance: null,
          external_feed_id: 'cdr-1',
        },
      ],
    });
    mockFeedCreate.mockResolvedValue({ id: 'feed-1' });

    const result = await syncBankAccountFeeds(INPUT);
    expect(mockFeedCreate).toHaveBeenCalledTimes(1);
    expect(result.body.transactions_synced).toBe(1);
  });
});
