/**
 * UNI-2113: POST /api/bank-feeds/bulk-reconcile
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { POST } from '@/app/api/bank-feeds/bulk-reconcile/route';

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceIdForUser: vi.fn(),
}));

vi.mock('@/lib/bank-reconciliation/scope', () => ({
  workspaceOwnerIds: vi.fn(),
  bankAccountOwnerFilter: vi.fn((ownerIds: string[]) => ({ ownerUserId: { in: ownerIds } })),
}));

vi.mock('@/lib/bank-reconciliation/apply-match', () => ({
  applyBankMatch: vi.fn(),
}));

vi.mock('@/lib/integrations/xero-reconciliation-export', () => ({
  exportReconciledFeedToXero: vi.fn(),
}));

const mockBankFeedFindFirst = vi.fn();
const mockPosFindFirst = vi.fn();
const mockAuditCreate = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    bankFeedTransaction: {
      findFirst: (...args: unknown[]) => mockBankFeedFindFirst(...args),
    },
    posTransaction: {
      findFirst: (...args: unknown[]) => mockPosFindFirst(...args),
    },
    reconciliationMatchAudit: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
  },
}));

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';
import { workspaceOwnerIds } from '@/lib/bank-reconciliation/scope';
import { applyBankMatch } from '@/lib/bank-reconciliation/apply-match';
import { exportReconciledFeedToXero } from '@/lib/integrations/xero-reconciliation-export';

const AUTH_USER_ID = 'user-alice';
const WORKSPACE_ID = 'ws-alice';

function setAuth(userId: string | null = AUTH_USER_ID, workspaceId: string | null = WORKSPACE_ID) {
  (requireAuthScope as Mock).mockResolvedValue(
    userId ? { userId, role: 'owner', isAdmin: false } : null
  );
  (getWorkspaceIdForUser as Mock).mockResolvedValue(workspaceId);
  (workspaceOwnerIds as Mock).mockResolvedValue(userId ? [userId] : []);
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/bank-feeds/bulk-reconcile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockFeed(id: string) {
  return { id, reconciled: false, matchedPosTxId: null, bankAccountId: 'acc-1' };
}

function mockPos(id: string) {
  return { id, reconciliationStatus: 'pending', ownerUserId: AUTH_USER_ID, amount: 100 };
}

function mockOwned(feedIds: string[], posIds: string[]) {
  mockBankFeedFindFirst.mockImplementation(({ where }: { where: { id: string } }) => {
    return feedIds.includes(where.id) ? mockFeed(where.id) : null;
  });
  mockPosFindFirst.mockImplementation(({ where }: { where: { id: string } }) => {
    return posIds.includes(where.id) ? mockPos(where.id) : null;
  });
}

describe('POST /api/bank-feeds/bulk-reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditCreate.mockResolvedValue({});
    (applyBankMatch as Mock).mockResolvedValue('feed-id');
    (exportReconciledFeedToXero as Mock).mockResolvedValue({ ok: true });
  });

  it('returns 401 when not authenticated', async () => {
    setAuth(null);
    const res = await POST(makeRequest({ matches: [{ bank_feed_id: 'f1', pos_transaction_id: 'p1' }] }) as never);
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated but no workspace', async () => {
    setAuth(AUTH_USER_ID, null);
    const res = await POST(makeRequest({ matches: [{ bank_feed_id: 'f1', pos_transaction_id: 'p1' }] }) as never);
    expect(res.status).toBe(403);
  });

  it('returns 400 when matches is empty array', async () => {
    setAuth();
    const res = await POST(makeRequest({ matches: [] }) as never);
    expect(res.status).toBe(400);
  });

  it('matches all 3 pairs when all are valid', async () => {
    setAuth();
    mockOwned(['f1', 'f2', 'f3'], ['p1', 'p2', 'p3']);

    const res = await POST(
      makeRequest({
        matches: [
          { bank_feed_id: 'f1', pos_transaction_id: 'p1' },
          { bank_feed_id: 'f2', pos_transaction_id: 'p2' },
          { bank_feed_id: 'f3', pos_transaction_id: 'p3' },
        ],
      }) as never
    );
    const body = await res.json() as { success: boolean; matched_count: number; failed_count: number };
    expect(body.success).toBe(true);
    expect(body.matched_count).toBe(3);
    expect(body.failed_count).toBe(0);
    expect(applyBankMatch).toHaveBeenCalledTimes(3);
  });

  it('partial failure: 3 of 10 pairs fail — 7 succeed', async () => {
    setAuth();
    const goodFeedIds = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'];
    const goodPosIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    mockOwned(goodFeedIds, goodPosIds);

    const matches = [
      ...goodFeedIds.map((f, i) => ({ bank_feed_id: f, pos_transaction_id: goodPosIds[i] })),
      { bank_feed_id: 'f8', pos_transaction_id: 'p8' },
      { bank_feed_id: 'f9', pos_transaction_id: 'p9' },
      { bank_feed_id: 'f10', pos_transaction_id: 'p10' },
    ];

    const res = await POST(makeRequest({ matches }) as never);
    const body = await res.json() as {
      success: boolean;
      matched_count: number;
      failed_count: number;
      failures: Array<{ bank_feed_id: string; reason: string }>;
    };

    expect(body.matched_count).toBe(7);
    expect(body.failed_count).toBe(3);
    expect(body.success).toBe(false);
    expect(body.failures).toHaveLength(3);
  });

  it('fails pair when bank feed is already reconciled (not returned by query)', async () => {
    setAuth();
    mockBankFeedFindFirst.mockResolvedValue(null);
    mockPosFindFirst.mockResolvedValue(mockPos('p1'));

    const res = await POST(
      makeRequest({ matches: [{ bank_feed_id: 'f1', pos_transaction_id: 'p1' }] }) as never
    );
    const body = await res.json() as { failed_count: number; failures: Array<{ reason: string }> };
    expect(body.failed_count).toBe(1);
    expect(body.failures[0].reason).toMatch(/not found/i);
  });

  it('fails pair when POS transaction is already reconciled', async () => {
    setAuth();
    mockBankFeedFindFirst.mockResolvedValue(mockFeed('f1'));
    mockPosFindFirst.mockResolvedValue({ ...mockPos('p1'), reconciliationStatus: 'reconciled' });

    const res = await POST(
      makeRequest({ matches: [{ bank_feed_id: 'f1', pos_transaction_id: 'p1' }] }) as never
    );
    const body = await res.json() as { failures: Array<{ reason: string }> };
    expect(body.failures[0].reason).toMatch(/already reconciled/i);
  });

  it('writes audit records for success and failure', async () => {
    setAuth();
    mockOwned(['f1'], ['p1']);
    mockBankFeedFindFirst.mockResolvedValueOnce(mockFeed('f1'));
    mockPosFindFirst.mockResolvedValueOnce(mockPos('p1'));

    await POST(makeRequest({ matches: [{ bank_feed_id: 'f1', pos_transaction_id: 'p1' }] }) as never);

    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: 'matched',
          bankFeedId: 'f1',
          posTransactionId: 'p1',
        }),
      })
    );
  });

  it('handles applyBankMatch throwing for one pair', async () => {
    setAuth();
    mockOwned(['f1', 'f2', 'f3'], ['p1', 'p2', 'p3']);
    (applyBankMatch as Mock)
      .mockResolvedValueOnce('f1')
      .mockRejectedValueOnce(new Error('DB deadlock'))
      .mockResolvedValueOnce('f3');

    const res = await POST(
      makeRequest({
        matches: [
          { bank_feed_id: 'f1', pos_transaction_id: 'p1' },
          { bank_feed_id: 'f2', pos_transaction_id: 'p2' },
          { bank_feed_id: 'f3', pos_transaction_id: 'p3' },
        ],
      }) as never
    );
    const body = await res.json() as { matched_count: number; failed_count: number; failures: Array<{ reason: string }> };
    expect(body.matched_count).toBe(2);
    expect(body.failed_count).toBe(1);
    expect(body.failures[0].reason).toMatch(/DB deadlock/i);
  });
});
