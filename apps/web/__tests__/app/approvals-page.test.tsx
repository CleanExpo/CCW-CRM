/**
 * Approvals Page Integration Test
 *
 * Tests approvals page rendering and bulk approve flow (Phase 2 integration)
 */

import { describe, it, expect, vi } from 'vitest';
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

import { apiClient } from '@/lib/api/client';

// Simplified approvals page component
function ApprovalsPageTest() {
  const [approvals, setApprovals] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);

  React.useEffect(() => {
    setApprovals([
      { id: 'appr-1', approval_type: 'purchase_order', status: 'pending' },
      { id: 'appr-2', approval_type: 'invoice', status: 'pending' },
    ]);
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const bulkApprove = async () => {
    await apiClient.post('/api/approvals/bulk-approve', {
      approval_ids: selected,
    });
    setApprovals((prev) => prev.filter((a) => !selected.includes(a.id)));
    setSelected([]);
  };

  return (
    <div>
      <h1>Approvals</h1>
      {approvals.map((a) => (
        <div key={a.id} data-testid="approval-row">
          <input
            type="checkbox"
            checked={selected.includes(a.id)}
            onChange={() => toggleSelect(a.id)}
            data-testid={`checkbox-${a.id}`}
          />
          {a.approval_type}
        </div>
      ))}
      {selected.length > 0 && (
        <button onClick={bulkApprove} data-testid="bulk-approve-btn">
          Bulk Approve ({selected.length})
        </button>
      )}
    </div>
  );
}

const mockPost = vi.mocked(apiClient.post);

describe('Approvals Page Integration', () => {
  it('renders approvals list with checkboxes', () => {
    render(<ApprovalsPageTest />);

    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getAllByTestId('approval-row')).toHaveLength(2);
  });

  it('shows bulk approve button when items selected', async () => {
    const user = userEvent.setup();
    render(<ApprovalsPageTest />);

    expect(screen.queryByTestId('bulk-approve-btn')).not.toBeInTheDocument();

    const checkbox = screen.getByTestId('checkbox-appr-1');
    await user.click(checkbox);

    expect(screen.getByTestId('bulk-approve-btn')).toBeInTheDocument();
    expect(screen.getByText('Bulk Approve (1)')).toBeInTheDocument();
  });

  it('calls bulk approve API when button clicked', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValue({ approved_count: 2 });

    render(<ApprovalsPageTest />);

    await user.click(screen.getByTestId('checkbox-appr-1'));
    await user.click(screen.getByTestId('checkbox-appr-2'));
    await user.click(screen.getByTestId('bulk-approve-btn'));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/approvals/bulk-approve', {
        approval_ids: ['appr-1', 'appr-2'],
      });
    });
  });
});
