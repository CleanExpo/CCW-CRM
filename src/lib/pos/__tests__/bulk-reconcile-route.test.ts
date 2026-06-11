/**
 * UNI-2113: POST /api/bank-feeds/bulk-reconcile
 *
 * Tests cover:
 * - 401 when unauthenticated
 * - 403 when authenticated but no workspace
 * - 400 when matches array is empty / missing
 * - Successful full-batch match (all pairs succeed)
 * - Partial failure: 3 of 10 pairs fail, 7 succeed — response itemises all 3 failures
 * - Already-reconciled guard: bank feed already reconciled → failure detail
 * - Already-reconciled guard: POS already reconciled → failure detail
 * - Missing IDs in pair → failure detail
 * - Cross-workspace isolation: cannot reconcile another user's records
 * - Audit trail: ReconciliationMatchAudit rows written for successes and failures
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { POST } from '@/app/api/bank-feeds/bulk-reconcile/route';

// ── Mock auth ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/data-scope', () => ({
  requireAuthScope: vi.fn(),
}));

vi.mock('@/lib/auth/workspace-scope', () => ({
  getWorkspaceIdForUser: vi.fn(),
}));

// ── Mock Prisma ────────────────────────────────────────────────────────────

const mockBankFeedFindFirst = vi.fn();
const mockPosFindFirst = vi.fn();
const mockBankFeedUpdate = vi.fn();
const mockPosUpdate = vi.fn();
const mockAuditCreate = vi.fn();
const mockTransaction = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    bankFeedTransaction: {
      findFirst: (...args: unknown[]) => mockBankFeedFindFirst(...args),
      update: (...args: unknown[]) => mockBankFeedUpdate(...args),
    },
    posTransaction: {
      findFirst: (...args: unknown[]) => mockPosFindFirst(...args),
      update: (...args: unknown[]) => mockPosUpdate(...args),
    },
    reconciliationMatchAudit: {
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { requireAuthScope } from '@/lib/auth/data-scope';
import { getWorkspaceIdForUser } from '@/lib/auth/workspace-scope';

// ── Helpers ────────────────────────────────────────────────────────────────

const AUTH_USER_ID = 'user-alice';
const WORKSPACE_ID = 'ws-alice';

function setAuth(userId: string | null = AUTH_USER_ID, workspaceId: string | null = WORKSPACE_ID) {
  (requireAuthScope as Mock).mockResolvedValue(
    userId ? { userId, role: 'owner', isAdmin: false } : null
  );
  (getWorkspaceIdForUser as Mock).mockResolvedValue(workspaceId);
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/bank-feeds/bulk-reconcile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Returns a mock bank feed record (unreconciled). */
function mockFeed(id: string) {
  return { id, reconciled: false, matchedPosTxId: null, bankAccountId: 'acc-1' };
}

/** Returns a mock POS transaction record (unreconciled). */
function mockPos(id: string) {
  return { id, reconciliationStatus: 'pending', ownerUserId: AUTH_USER_ID, amount: 100 };
}

/**
 * Sets up mockBankFeedFindFirst and mockPosFindFirst to return valid records
 * for the given IDs (ownership check passes).
 */
function mockOwned(feedIds: string[], posIds: string[]) {
  mockBankFeedFindFirst.mockImplementation(({ where }: { where: { id: string } }) => {
    return feedIds.includes(where.id) ? mockFeed(where.id) : null;
  });
  mockPosFindFirst.mockImplementation(({ where }: { where: { id: string } }) => {
    return posIds.includes(where.id) ? mockPos(where.id) : null;
  });
}

/** Sets up $transaction to execute all writes atomically (no real DB). */
function mockTransactionSuccess() {
  mockTransaction.mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) {
      await (op as Promise<unknown>);
    }
    return undefined;
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────

describe('POST /api/bank-feeds/bulk-reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBankFeedUpdate.mockResolvedValue({});
    mockPosUpdate.mockResolvedValue({});
    mockAuditCreate.mockResolvedValue({});
    mockTransactionSuccess();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

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

  // ── Validation ────────────────────────────────────────────────────────────

  it('returns 400 when matches is empty array', async () => {
    setAuth();
    const res = await POST(makeRequest({ matches: [] }) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when matches is missing', async () => {
    setAuth();
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is not valid JSON', async () => {
    setAuth();
    const res = await POST(
      new Request('http://localhost/api/bank-feeds/bulk-reconcile', {
        method: 'POST',
        body: 'not-json',
      }) as never
    );
    expect(res.status).toBe(400);
  });

  // ── Full success ──────────────────────────────────────────────────────────

  it('matches all 3 pairs when all are valid → success=true, matched_count=3, failed_count=0', async () => {
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
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      matched_count: number;
      failed_count: number;
      failures: unknown[];
    };
    expect(body.success).toBe(true);
    expect(body.matched_count).toBe(3);
    expect(body.failed_count).toBe(0);
    expect(body.failures).toHaveLength(0);
  });

  // ── Partial failure: core UNI-2113 acceptance criterion ──────────────────

  it('partial failure: 3 of 10 pairs fail — 7 succeed, response itemises 3 failures', async () => {
    setAuth();

    // IDs f1–f7 and p1–p7 are accessible; f8–f10 and p8–p10 are NOT (simulate ownership fail)
    const goodFeedIds = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'];
    const goodPosIds  = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];
    mockOwned(goodFeedIds, goodPosIds);

    const matches = [
      ...goodFeedIds.map((f, i) => ({ bank_feed_id: f, pos_transaction_id: goodPosIds[i] })),
      { bank_feed_id: 'f8', pos_transaction_id: 'p8' },  // not found
      { bank_feed_id: 'f9', pos_transaction_id: 'p9' },  // not found
      { bank_feed_id: 'f10', pos_transaction_id: 'p10' }, // not found
    ];

    const res = await POST(makeRequest({ matches }) as never);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      matched_count: number;
      failed_count: number;
      failures: Array<{ bank_feed_id: string; pos_transaction_id: string; reason: string }>;
      errors: string[];
    };

    // Exactly 7 successes
    expect(body.matched_count).toBe(7);
    // Exactly 3 failures
    expect(body.failed_count).toBe(3);
    expect(body.success).toBe(false);

    // Failures array itemises each failed pair
    expect(body.failures).toHaveLength(3);
    const failedFeedIds = body.failures.map((f) => f.bank_feed_id);
    expect(failedFeedIds).toContain('f8');
    expect(failedFeedIds).toContain('f9');
    expect(failedFeedIds).toContain('f10');

    // Each failure has a human-readable reason
    body.failures.forEach((f) => {
      expect(typeof f.reason).toBe('string');
      expect(f.reason.length).toBeGreaterThan(0);
    });

    // Backwards-compat errors array also has 3 entries
    expect(body.errors).toHaveLength(3);
  });

  // ── Already-reconciled guards ─────────────────────────────────────────────

  it('fails pair when bank feed is already reconciled', async () => {
    setAuth();
    // Feed is already reconciled
    mockBankFeedFindFirst.mockResolvedValue({ id: 'f1', reconciled: true, matchedPosTxId: 'p-old' });
    mockPosFindFirst.mockResolvedValue(mockPos('p1'));

    const res = await POST(
      makeRequest({ matches: [{ bank_feed_id: 'f1', pos_transaction_id: 'p1' }] }) as never
    );
    const body = await res.json() as {
      matched_count: number;
      failed_count: number;
      failures: Array<{ reason: string }>;
    };
    expect(body.matched_count).toBe(0);
    expect(body.failed_count).toBe(1);
    expect(body.failures[0].reason).toMatch(/already reconciled/i);
  });

  it('fails pair when POS transaction is already reconciled', async () => {
    setAuth();
    mockBankFeedFindFirst.mockResolvedValue(mockFeed('f1'));
    mockPosFindFirst.mockResolvedValue({ ...mockPos('p1'), reconciliationStatus: 'reconciled' });

    const res = await POST(
      makeRequest({ matches: [{ bank_feed_id: 'f1', pos_transaction_id: 'p1' }] }) as never
    );
    const body = await res.json() as {
      matched_count: number;
      failed_count: number;
      failures: Array<{ reason: string }>;
    };
    expect(body.matched_count).toBe(0);
    expect(body.failed_count).toBe(1);
    expect(body.failures[0].reason).toMatch(/already reconciled/i);
  });

  // ── Missing IDs ───────────────────────────────────────────────────────────

  it('fails pair when bank_feed_id is missing', async () => {
    setAuth();
    const res = await POST(
      makeRequest({ matches: [{ pos_transaction_id: 'p1' }] }) as never
    );
    const body = await res.json() as { failed_count: number; failures: Array<{ reason: string }> };
    expect(body.failed_count).toBe(1);
    expect(body.failures[0].reason).toMatch(/missing/i);
  });

  it('fails pair when pos_transaction_id is missing', async () => {
    setAuth();
    const res = await POST(
      makeRequest({ matches: [{ bank_feed_id: 'f1' }] }) as never
    );
    const body = await res.json() as { failed_count: number; failures: Array<{ reason: string }> };
    expect(body.failed_count).toBe(1);
    expect(body.failures[0].reason).toMatch(/missing/i);
  });

  // ── Cross-workspace isolation ─────────────────────────────────────────────

  it('fails pair when bank feed belongs to a different user', async () => {
    setAuth();
    // Feed not found (ownership filter rejects it)
    mockBankFeedFindFirst.mockResolvedValue(null);
    mockPosFindFirst.mockResolvedValue(mockPos('p1'));

    const res = await POST(
      makeRequest({ matches: [{ bank_feed_id: 'other-user-feed', pos_transaction_id: 'p1' }] }) as never
    );
    const body = await res.json() as { matched_count: number; failed_count: number; failures: Array<{ reason: string }> };
    expect(body.matched_count).toBe(0);
    expect(body.failed_count).toBe(1);
    expect(body.failures[0].reason).toMatch(/not found/i);
  });

  it('fails pair when POS transaction belongs to a different user', async () => {
    setAuth();
    mockBankFeedFindFirst.mockResolvedValue(mockFeed('f1'));
    mockPosFindFirst.mockResolvedValue(null); // POS ownership check fails

    const res = await POST(
      makeRequest({ matches: [{ bank_feed_id: 'f1', pos_transaction_id: 'other-user-pos' }] }) as never
    );
    const body = await res.json() as { matched_count: number; failed_count: number; failures: Array<{ reason: string }> };
    expect(body.matched_count).toBe(0);
    expect(body.failed_count).toBe(1);
    expect(body.failures[0].reason).toMatch(/not found/i);
  });

  // ── Audit trail ───────────────────────────────────────────────────────────

  it('writes one audit record per successful match', async () => {
    setAuth();
    mockOwned(['f1', 'f2'], ['p1', 'p2']);

    await POST(
      makeRequest({
        matches: [
          { bank_feed_id: 'f1', pos_transaction_id: 'p1' },
          { bank_feed_id: 'f2', pos_transaction_id: 'p2' },
        ],
      }) as never
    );

    // $transaction is called once per successful pair
    expect(mockTransaction).toHaveBeenCalledTimes(2);

    // Each $transaction call includes the audit create as the 3rd operation
    const firstCallOps: unknown[] = mockTransaction.mock.calls[0][0];
    expect(Array.isArray(firstCallOps)).toBe(true);
    expect(firstCallOps).toHaveLength(3); // update feed, update pos, create audit
  });

  it('writes a failure audit record when ownership check fails', async () => {
    setAuth();
    mockBankFeedFindFirst.mockResolvedValue(null);
    mockPosFindFirst.mockResolvedValue(null);

    await POST(
      makeRequest({ matches: [{ bank_feed_id: 'bad-feed', pos_transaction_id: 'bad-pos' }] }) as never
    );

    // Audit create called with outcome='failed'
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: 'failed',
          matchedByUserId: AUTH_USER_ID,
        }),
      })
    );
  });

  it('audit record for success includes matchedByUserId, bankFeedId, posTransactionId', async () => {
    setAuth();
    mockOwned(['f1'], ['p1']);

    // Capture the ops passed to $transaction
    mockTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await (op as Promise<unknown>);
    });

    await POST(
      makeRequest({ matches: [{ bank_feed_id: 'f1', pos_transaction_id: 'p1' }] }) as never
    );

    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchedByUserId: AUTH_USER_ID,
          bankFeedId: 'f1',
          posTransactionId: 'p1',
          outcome: 'matched',
        }),
      })
    );
  });

  // ── DB error in transaction → partial failure ─────────────────────────────

  it('handles $transaction throwing for one pair: that pair fails, others succeed', async () => {
    setAuth();
    mockOwned(['f1', 'f2', 'f3'], ['p1', 'p2', 'p3']);

    // Second call to $transaction throws
    let txCallCount = 0;
    mockTransaction.mockImplementation(async (ops: unknown[]) => {
      txCallCount++;
      if (txCallCount === 2) throw new Error('DB deadlock');
      for (const op of ops) await (op as Promise<unknown>);
    });

    const res = await POST(
      makeRequest({
        matches: [
          { bank_feed_id: 'f1', pos_transaction_id: 'p1' },
          { bank_feed_id: 'f2', pos_transaction_id: 'p2' },
          { bank_feed_id: 'f3', pos_transaction_id: 'p3' },
        ],
      }) as never
    );
    const body = await res.json() as {
      matched_count: number;
      failed_count: number;
      failures: Array<{ reason: string }>;
    };
    expect(body.matched_count).toBe(2);
    expect(body.failed_count).toBe(1);
    expect(body.failures[0].reason).toMatch(/DB deadlock/i);
  });
});
