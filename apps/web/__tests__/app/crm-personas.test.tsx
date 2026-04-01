/**
 * CRM Persona Tagging Page Tests
 *
 * Tests loading personas, filtering, and classify-all action.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
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
const mockPost = vi.mocked(apiClient.post);

const mockPersonasResponse = {
  items: [
    {
      id: 'cust-1',
      customer_number: 'CUST-001',
      company_name: 'Pro Clean Services',
      contact_name: 'Alice',
      email: 'alice@proclean.com',
      persona: 'high_value',
      persona_confidence: 0.92,
      persona_last_updated: '2026-01-15T10:00:00Z',
      is_active: true,
    },
    {
      id: 'cust-2',
      customer_number: 'CUST-002',
      company_name: 'Budget Sweep',
      contact_name: 'Mark',
      email: 'mark@budgetsweep.com',
      persona: 'price_sensitive',
      persona_confidence: 0.76,
      persona_last_updated: '2026-01-10T08:00:00Z',
      is_active: true,
    },
    {
      id: 'cust-3',
      customer_number: 'CUST-003',
      company_name: 'New Startup Clean',
      contact_name: null,
      email: null,
      persona: null,
      persona_confidence: null,
      persona_last_updated: null,
      is_active: true,
    },
  ],
  total: 3,
};

// Simplified personas page test component
function PersonasPageTest() {
  const [data, setData] = React.useState<typeof mockPersonasResponse | null>(null);
  const [personaFilter, setPersonaFilter] = React.useState('all');
  const [classifying, setClassifying] = React.useState(false);
  const toast = vi.fn();

  const load = React.useCallback(() => {
    const params = personaFilter !== 'all' ? `?persona=${personaFilter}` : '';
    apiClient.get(`/api/crm/personas${params}`).then((res: any) => setData(res));
  }, [personaFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  const classifyAll = async () => {
    setClassifying(true);
    try {
      const res = await apiClient.post<{ classified: number; summary: Record<string, number> }>(
        '/api/crm/personas/classify-all',
        {}
      );
      toast({
        title: 'Classification complete',
        description: `${res.classified} customers classified.`,
      });
      load();
    } finally {
      setClassifying(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <div>
      <h1>Customer Personas</h1>
      <select
        data-testid="persona-filter"
        value={personaFilter}
        onChange={(e) => setPersonaFilter(e.target.value)}
      >
        <option value="all">All</option>
        <option value="high_value">High Value</option>
        <option value="price_sensitive">Price Sensitive</option>
      </select>
      <button data-testid="classify-all" onClick={classifyAll} disabled={classifying}>
        {classifying ? 'Classifying...' : 'Classify All'}
      </button>
      {items.map((item) => (
        <div key={item.id} data-testid="persona-row">
          <span data-testid={`company-${item.id}`}>{item.company_name}</span>
          <span data-testid={`persona-${item.id}`}>{item.persona ?? 'Unclassified'}</span>
        </div>
      ))}
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CRM Personas Page', () => {
  it('calls GET /api/crm/personas on mount', async () => {
    mockGet.mockResolvedValue(mockPersonasResponse);
    render(<PersonasPageTest />);
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/crm/personas');
    });
  });

  it('renders all persona rows', async () => {
    mockGet.mockResolvedValue(mockPersonasResponse);
    render(<PersonasPageTest />);
    await waitFor(() => {
      expect(screen.getAllByTestId('persona-row')).toHaveLength(3);
    });
  });

  it('displays company names and personas', async () => {
    mockGet.mockResolvedValue(mockPersonasResponse);
    render(<PersonasPageTest />);
    await waitFor(() => {
      expect(screen.getByText('Pro Clean Services')).toBeDefined();
      expect(screen.getByTestId('persona-cust-1').textContent).toBe('high_value');
    });
  });

  it('shows "Unclassified" for customers with no persona', async () => {
    mockGet.mockResolvedValue(mockPersonasResponse);
    render(<PersonasPageTest />);
    await waitFor(() => {
      expect(screen.getByTestId('persona-cust-3').textContent).toBe('Unclassified');
    });
  });

  it('appends persona filter to API call', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    const user = userEvent.setup();
    render(<PersonasPageTest />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    await user.selectOptions(screen.getByTestId('persona-filter'), 'high_value');

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/crm/personas?persona=high_value');
    });
  });

  it('calls POST /api/crm/personas/classify-all when button clicked', async () => {
    mockGet.mockResolvedValue(mockPersonasResponse);
    mockPost.mockResolvedValue({ classified: 12, summary: { high_value: 4, price_sensitive: 8 } });
    const user = userEvent.setup();
    render(<PersonasPageTest />);

    await waitFor(() => screen.getByTestId('classify-all'));
    await user.click(screen.getByTestId('classify-all'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/crm/personas/classify-all', {});
    });
  });

  it('reloads data after classify-all completes', async () => {
    mockGet.mockResolvedValue(mockPersonasResponse);
    mockPost.mockResolvedValue({ classified: 5, summary: {} });
    const user = userEvent.setup();
    render(<PersonasPageTest />);

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    await user.click(screen.getByTestId('classify-all'));

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});
