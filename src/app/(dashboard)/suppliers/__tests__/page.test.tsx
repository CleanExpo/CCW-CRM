import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, list } = vi.hoisted(() => ({ toast: vi.fn(), list: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api', () => ({ suppliersApi: { list, delete: vi.fn() } }));
vi.mock('@/components/integrations/Cin7MasterDataNav', () => ({ Cin7MasterDataNav: () => null }));
vi.mock('@/components/integrations/Cin7SyncButton', () => ({ Cin7PageSyncToolbar: () => null }));
vi.mock('../components/SupplierForm', () => ({ SupplierForm: () => null }));

import SuppliersPage from '../page';

const EMPTY = { items: [], total: 0, page: 1, page_size: 50, total_pages: 0 };

describe('SuppliersPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error state, not "No suppliers found", when the load fails', async () => {
    list.mockRejectedValue(new Error('Network down'));

    render(<SuppliersPage />);

    expect(await screen.findByText("Couldn't load suppliers")).toBeInTheDocument();
    expect(screen.queryByText('No suppliers found')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows the genuine empty state when the load succeeds with no rows', async () => {
    list.mockResolvedValue(EMPTY);

    render(<SuppliersPage />);

    expect(await screen.findByText('No suppliers found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load suppliers")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    list.mockRejectedValue(new Error('Network down'));
    render(<SuppliersPage />);
    await screen.findByText("Couldn't load suppliers");
    const callsBefore = list.mock.calls.length;

    list.mockResolvedValue(EMPTY);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No suppliers found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load suppliers")).not.toBeInTheDocument();
  });
});
