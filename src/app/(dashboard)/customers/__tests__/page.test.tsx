import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get } = vi.hoisted(() => ({ toast: vi.fn(), get: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/customers',
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));
vi.mock('@/components/integrations/Cin7MasterDataNav', () => ({ Cin7MasterDataNav: () => null }));
vi.mock('@/components/integrations/Cin7SyncButton', () => ({ Cin7PageSyncToolbar: () => null }));
vi.mock('../components/CustomerForm', () => ({ CustomerForm: () => null }));
vi.mock('../components/DeleteCustomerDialog', () => ({ DeleteCustomerDialog: () => null }));
vi.mock('../components/BulkDeleteCustomersDialog', () => ({
  BulkDeleteCustomersDialog: () => null,
}));

import CustomersPage from '../page';

const EMPTY = { items: [], total: 0, page: 1, page_size: 50, total_pages: 0 };

describe('CustomersPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows an error state, not "No customers found", when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<CustomersPage />);

    expect(await screen.findByText("Couldn't load customers")).toBeInTheDocument();
    expect(screen.queryByText('No customers found')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows the genuine empty state when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<CustomersPage />);

    expect(await screen.findByText('No customers found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load customers")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<CustomersPage />);
    await screen.findByText("Couldn't load customers");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue(EMPTY);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No customers found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load customers")).not.toBeInTheDocument();
  });
});
