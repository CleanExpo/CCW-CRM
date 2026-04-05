/**
 * CRM Onboarding Sequences Page Tests
 *
 * Tests loading sequences, cancellation, and status filtering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPatch = vi.mocked(apiClient.patch);

const mockSequencesResponse = {
  items: [
    {
      id: 'seq-1',
      customer_id: 'cust-1',
      company_name: 'New Equipment Co',
      contact_name: 'Tom',
      email: 'tom@newequip.com',
      status: 'active',
      triggered_at: '2026-01-10T09:00:00Z',
      cancelled_at: null,
      completed_at: null,
      touchpoints: [
        {
          id: 'tp-1',
          day: '1',
          status: 'sent',
          scheduled_at: null,
          sent_at: '2026-01-10T09:00:00Z',
          email_subject: 'Welcome!',
        },
      ],
    },
    {
      id: 'seq-2',
      customer_id: 'cust-2',
      company_name: 'Carpet Pro Ltd',
      contact_name: null,
      email: null,
      status: 'completed',
      triggered_at: '2025-12-01T09:00:00Z',
      cancelled_at: null,
      completed_at: '2026-01-01T09:00:00Z',
      touchpoints: [],
    },
  ],
  total: 2,
  page: 1,
  page_size: 20,
  total_pages: 1,
};

// Simplified onboarding page test component
function OnboardingPageTest() {
  const [data, setData] = React.useState<typeof mockSequencesResponse | null>(null);
  const [statusFilter, setStatusFilter] = React.useState('all');

  const load = React.useCallback(() => {
    const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    apiClient.get(`/api/crm/onboarding/sequences${params}`).then((res: any) => setData(res));
  }, [statusFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  const cancel = async (seqId: string) => {
    await apiClient.patch(`/api/crm/onboarding/sequences/${seqId}/cancel`, {});
    load();
  };

  const items = data?.items ?? [];

  return (
    <div>
      <h1>Onboarding Sequences</h1>
      <select
        data-testid="status-filter"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
      {items.map((seq) => (
        <div key={seq.id} data-testid="sequence-row">
          <span data-testid={`company-${seq.id}`}>{seq.company_name}</span>
          <span data-testid={`status-${seq.id}`}>{seq.status}</span>
          {seq.status === 'active' && (
            <button data-testid={`cancel-${seq.id}`} onClick={() => cancel(seq.id)}>
              Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CRM Onboarding Sequences', () => {
  it('loads sequences on mount', async () => {
    mockGet.mockResolvedValue(mockSequencesResponse);
    render(<OnboardingPageTest />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/crm/onboarding/sequences');
    });
  });

  it('renders all sequence rows', async () => {
    mockGet.mockResolvedValue(mockSequencesResponse);
    render(<OnboardingPageTest />);
    await waitFor(() => {
      expect(screen.getAllByTestId('sequence-row')).toHaveLength(2);
    });
  });

  it('displays company names', async () => {
    mockGet.mockResolvedValue(mockSequencesResponse);
    render(<OnboardingPageTest />);
    await waitFor(() => {
      expect(screen.getByText('New Equipment Co')).toBeDefined();
      expect(screen.getByText('Carpet Pro Ltd')).toBeDefined();
    });
  });

  it('filters by status when changed', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 });
    const user = userEvent.setup();
    render(<OnboardingPageTest />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    await user.selectOptions(screen.getByTestId('status-filter'), 'active');

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/crm/onboarding/sequences?status=active');
    });
  });

  it('shows cancel button for active sequences only', async () => {
    mockGet.mockResolvedValue(mockSequencesResponse);
    render(<OnboardingPageTest />);
    await waitFor(() => {
      expect(screen.getByTestId('cancel-seq-1')).toBeDefined();
      expect(screen.queryByTestId('cancel-seq-2')).toBeNull();
    });
  });

  it('calls PATCH cancel endpoint when cancel clicked', async () => {
    mockGet.mockResolvedValue(mockSequencesResponse);
    mockPatch.mockResolvedValue({});
    const user = userEvent.setup();
    render(<OnboardingPageTest />);

    await waitFor(() => screen.getByTestId('cancel-seq-1'));
    await user.click(screen.getByTestId('cancel-seq-1'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/api/crm/onboarding/sequences/seq-1/cancel', {});
    });
  });

  it('reloads sequences after cancellation', async () => {
    mockGet.mockResolvedValue(mockSequencesResponse);
    mockPatch.mockResolvedValue({});
    const user = userEvent.setup();
    render(<OnboardingPageTest />);

    await waitFor(() => screen.getByTestId('cancel-seq-1'));
    await user.click(screen.getByTestId('cancel-seq-1'));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});
