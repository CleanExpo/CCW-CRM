/**
 * Reconciliation API Client Tests
 *
 * Tests for bank reconciliation API endpoints (Phase 2 - Batch 2D)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { apiClient } from '@/lib/api/client';

// Reconciliation API client (inline - not exported in lib/api yet)
const reconciliationApi = {
  async getMatchSuggestions(transactionId: string) {
    return apiClient.get(`/api/reconciliation/match-suggestions?transaction_id=${transactionId}`);
  },

  async autoMatch(transactionId: string, matchId: string) {
    return apiClient.post('/api/reconciliation/auto-match', {
      transaction_id: transactionId,
      match_id: matchId,
    });
  },
};

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

// ─── Match Suggestions ──────────────────────────────────────────────

describe('reconciliationApi.getMatchSuggestions', () => {
  it('calls GET /api/reconciliation/match-suggestions with transaction_id', async () => {
    const mockSuggestions = [
      { id: 'match-1', invoice_id: 'inv-1', confidence: 0.95, amount: 100.0 },
      { id: 'match-2', invoice_id: 'inv-2', confidence: 0.85, amount: 100.5 },
    ];
    mockGet.mockResolvedValue(mockSuggestions);

    const result = await reconciliationApi.getMatchSuggestions('txn-123');

    expect(mockGet).toHaveBeenCalledWith(
      '/api/reconciliation/match-suggestions?transaction_id=txn-123'
    );
    expect(result as any).toEqual(mockSuggestions);
    expect(result as any[]).toHaveLength(2);
  });

  it('returns empty array when no matches found', async () => {
    mockGet.mockResolvedValue([]);
    const result = await reconciliationApi.getMatchSuggestions('txn-no-match');
    expect(result as any[]).toEqual([]);
  });
});

// ─── Auto Match ─────────────────────────────────────────────────────

describe('reconciliationApi.autoMatch', () => {
  it('calls POST /api/reconciliation/auto-match with transaction and match IDs', async () => {
    const mockMatched = { transaction_id: 'txn-123', match_id: 'match-1', status: 'matched' };
    mockPost.mockResolvedValue(mockMatched);

    const result = await reconciliationApi.autoMatch('txn-123', 'match-1');

    expect(mockPost).toHaveBeenCalledWith('/api/reconciliation/auto-match', {
      transaction_id: 'txn-123',
      match_id: 'match-1',
    });
    expect((result as any).status).toBe('matched');
  });

  it('propagates errors on failed match', async () => {
    mockPost.mockRejectedValue(new Error('Match already exists'));
    await expect(reconciliationApi.autoMatch('txn-123', 'match-1')).rejects.toThrow(
      'Match already exists'
    );
  });
});
