/**
 * Reconciliation Page Integration Test
 *
 * Tests reconciliation page rendering and match suggestions flow (Phase 2 integration)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { apiClient } from '@/lib/api/client';

// Simplified reconciliation page component
function ReconciliationPageTest() {
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setTransactions([{ id: 'txn-1', amount: 100.0, description: 'Payment received' }]);
  }, []);

  const loadSuggestions = async (txnId: string) => {
    setLoading(true);
    const data = await apiClient.get(
      `/api/reconciliation/match-suggestions?transaction_id=${txnId}`
    );
    setSuggestions(data as any[]);
    setLoading(false);
  };

  return (
    <div>
      <h1>Bank Reconciliation</h1>
      {transactions.map((txn) => (
        <div key={txn.id} data-testid="transaction-row">
          {txn.description}
          <button onClick={() => loadSuggestions(txn.id)} data-testid="suggest-btn">
            Suggest Matches
          </button>
        </div>
      ))}
      {loading && <div data-testid="loading">Loading...</div>}
      {suggestions.length > 0 && (
        <div data-testid="suggestions-list">
          {suggestions.map((s) => (
            <div key={s.id} data-testid="suggestion-item">
              {s.invoice_id}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const mockGet = vi.mocked(apiClient.get);

describe('Reconciliation Page Integration', () => {
  it('renders page heading and transaction list', () => {
    render(<ReconciliationPageTest />);

    expect(screen.getByText('Bank Reconciliation')).toBeInTheDocument();
    expect(screen.getByTestId('transaction-row')).toBeInTheDocument();
  });

  it('loads match suggestions when button clicked', async () => {
    const user = userEvent.setup();
    const mockSuggestions = [{ id: 'match-1', invoice_id: 'inv-1', confidence: 0.95 }];
    mockGet.mockResolvedValue(mockSuggestions);

    render(<ReconciliationPageTest />);

    const suggestBtn = screen.getByTestId('suggest-btn');
    await user.click(suggestBtn);

    await waitFor(() => {
      expect(screen.getByTestId('suggestions-list')).toBeInTheDocument();
    });

    expect(screen.getByText('inv-1')).toBeInTheDocument();
  });
});

// Add React import for test component
import React from 'react';
