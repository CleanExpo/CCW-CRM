/**
 * CRM Client Health Dashboard Tests
 *
 * Tests the health score fetch, status filtering, and score display logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('@/lib/api/client', () => ({
  apiClient: { get: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);

const mockHealthResponse = {
  items: [
    {
      customer_id: 'cust-1',
      customer_number: 'CUST-001',
      company_name: 'CCW Test Client',
      contact_name: 'Jane Smith',
      email: 'jane@ccrtest.com',
      is_active: true,
      order_count: 5,
      quote_count: 3,
      last_order_days: 12,
      health_score: 82,
      health_status: 'green',
      score_breakdown: { recency: 90, volume: 80, engagement: 75, account: 85 },
    },
    {
      customer_id: 'cust-2',
      customer_number: 'CUST-002',
      company_name: 'At-Risk Cleaner',
      contact_name: null,
      email: null,
      is_active: true,
      order_count: 1,
      quote_count: 0,
      last_order_days: 95,
      health_score: 28,
      health_status: 'red',
      score_breakdown: { recency: 20, volume: 30, engagement: 25, account: 40 },
    },
  ],
  total: 2,
};

// Simplified health page test component
function HealthPageTest() {
  const [data, setData] = React.useState<typeof mockHealthResponse | null>(null);
  const [filter, setFilter] = React.useState('all');

  React.useEffect(() => {
    const params = filter !== 'all' ? `?status=${filter}` : '';
    apiClient.get(`/api/crm/health-scores${params}`).then((res: any) => setData(res));
  }, [filter]);

  const items = data?.items ?? [];

  return (
    <div>
      <h1>Client Health Dashboard</h1>
      <select
        data-testid="status-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="all">All</option>
        <option value="red">At Risk</option>
        <option value="green">Healthy</option>
      </select>
      <div data-testid="total">{data?.total ?? 0}</div>
      {items.map((item) => (
        <div key={item.customer_id} data-testid="health-row">
          <span data-testid="company">{item.company_name}</span>
          <span data-testid={`score-${item.customer_id}`}>{item.health_score}</span>
          <span data-testid={`status-${item.customer_id}`}>{item.health_status}</span>
        </div>
      ))}
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CRM Health Dashboard', () => {
  it('loads health scores on mount', async () => {
    mockGet.mockResolvedValue(mockHealthResponse);
    render(<HealthPageTest />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/crm/health-scores');
    });
  });

  it('renders health rows after data loads', async () => {
    mockGet.mockResolvedValue(mockHealthResponse);
    render(<HealthPageTest />);
    await waitFor(() => {
      expect(screen.getAllByTestId('health-row')).toHaveLength(2);
    });
  });

  it('displays company names', async () => {
    mockGet.mockResolvedValue(mockHealthResponse);
    render(<HealthPageTest />);
    await waitFor(() => {
      expect(screen.getByText('CCW Test Client')).toBeDefined();
      expect(screen.getByText('At-Risk Cleaner')).toBeDefined();
    });
  });

  it('shows correct health scores', async () => {
    mockGet.mockResolvedValue(mockHealthResponse);
    render(<HealthPageTest />);
    await waitFor(() => {
      expect(screen.getByTestId('score-cust-1').textContent).toBe('82');
      expect(screen.getByTestId('score-cust-2').textContent).toBe('28');
    });
  });

  it('shows health status badges', async () => {
    mockGet.mockResolvedValue(mockHealthResponse);
    render(<HealthPageTest />);
    await waitFor(() => {
      expect(screen.getByTestId('status-cust-1').textContent).toBe('green');
      expect(screen.getByTestId('status-cust-2').textContent).toBe('red');
    });
  });

  it('appends status filter to API call when changed', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    const user = userEvent.setup();
    render(<HealthPageTest />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    await user.selectOptions(screen.getByTestId('status-filter'), 'red');

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/crm/health-scores?status=red');
    });
  });

  it('displays total count', async () => {
    mockGet.mockResolvedValue(mockHealthResponse);
    render(<HealthPageTest />);
    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('2');
    });
  });
});
