import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get } = vi.hoisted(() => ({ toast: vi.fn(), get: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/operations/orders',
}));
vi.mock('@/components/integrations/Cin7MasterDataNav', () => ({ Cin7MasterDataNav: () => null }));
vi.mock('@/components/integrations/Cin7SyncButton', () => ({ Cin7PageSyncToolbar: () => null }));
vi.mock('@/lib/api/invoices', () => ({ invoicesApi: {} }));
vi.mock('../components/BulkDeleteOrdersDialog', () => ({ BulkDeleteOrdersDialog: () => null }));
vi.mock('../components/DeleteOrderDialog', () => ({ DeleteOrderDialog: () => null }));
vi.mock('../components/OrderDetailDialog', () => ({ OrderDetailDialog: () => null }));
vi.mock('../components/OrderForm', () => ({ OrderForm: () => null }));

import OrdersPage from '../page';

const EMPTY = { items: [], total: 0, page: 1, page_size: 50, total_pages: 0 };

describe('OrdersPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows an error state, not "No equipment orders yet", when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<OrdersPage />);

    expect(await screen.findByText("Couldn't load orders")).toBeInTheDocument();
    expect(screen.queryByText('No equipment orders yet')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows the genuine empty state when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<OrdersPage />);

    expect(await screen.findByText('No equipment orders yet')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load orders")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<OrdersPage />);
    await screen.findByText("Couldn't load orders");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue(EMPTY);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No equipment orders yet')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load orders")).not.toBeInTheDocument();
  });
});
