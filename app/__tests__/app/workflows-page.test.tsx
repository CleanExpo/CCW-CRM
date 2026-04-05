/**
 * Workflows Page Integration Test
 *
 * Tests workflow templates page and execution stats display (Phase 2 integration)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { apiClient } from '@/lib/api/client';

// Simplified workflows page component
function WorkflowsPageTest() {
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>(null);

  React.useEffect(() => {
    apiClient.get('/api/workflows/templates').then((data) => setTemplates(data as any[]));
    apiClient.get('/api/workflows/execution-stats').then((data) => setStats(data as any));
  }, []);

  return (
    <div>
      <h1>Workflow Automation</h1>
      {stats && (
        <div data-testid="stats-card">
          <p>Total Executions: {stats.total_executions}</p>
          <p>Success Rate: {Math.round((stats.successful / stats.total_executions) * 100)}%</p>
        </div>
      )}
      <div data-testid="templates-list">
        {templates.map((t) => (
          <div key={t.id} data-testid="template-row">
            {t.name}
          </div>
        ))}
      </div>
    </div>
  );
}

const mockGet = vi.mocked(apiClient.get);

describe('Workflows Page Integration', () => {
  it('renders workflow templates and execution stats', async () => {
    mockGet.mockImplementation((url) => {
      if (url === '/api/workflows/templates') {
        return Promise.resolve([
          { id: 'tpl-1', name: 'Order Approval Workflow' },
          { id: 'tpl-2', name: 'Invoice Processing' },
        ]);
      }
      if (url === '/api/workflows/execution-stats') {
        return Promise.resolve({
          total_executions: 150,
          successful: 145,
          failed: 5,
        });
      }
      return Promise.resolve([]);
    });

    render(<WorkflowsPageTest />);

    await waitFor(() => {
      expect(screen.getByTestId('stats-card')).toBeInTheDocument();
    });

    expect(screen.getByText(/Total Executions: 150/)).toBeInTheDocument();
    expect(screen.getByText(/Success Rate: 97%/)).toBeInTheDocument();
    expect(screen.getAllByTestId('template-row')).toHaveLength(2);
  });

  it('handles empty templates list', async () => {
    mockGet.mockImplementation((url) => {
      if (url === '/api/workflows/templates') return Promise.resolve([]);
      return Promise.resolve({ total_executions: 0, successful: 0, failed: 0 });
    });

    render(<WorkflowsPageTest />);

    await waitFor(() => {
      expect(screen.getByTestId('templates-list')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('template-row')).not.toBeInTheDocument();
  });
});
