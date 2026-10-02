import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get } = vi.hoisted(() => ({ toast: vi.fn(), get: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/products',
}));
vi.mock('@/components/integrations/Cin7MasterDataNav', () => ({ Cin7MasterDataNav: () => null }));
vi.mock('@/components/integrations/Cin7SyncButton', () => ({ Cin7PageSyncToolbar: () => null }));
vi.mock('@/hooks/use-sse', () => ({
  useInventoryStream: () => ({
    data: null,
    status: 'disconnected',
    stats: { messagesReceived: 0 },
  }),
}));
vi.mock('@/components/ui/real-time-indicator', () => ({ RealTimeIndicator: () => null }));
vi.mock('../../inventory/components/StockTransferDialog', () => ({
  StockTransferDialog: () => null,
}));
vi.mock('../components/BulkDeleteProductsDialog', () => ({ BulkDeleteProductsDialog: () => null }));
vi.mock('../components/DeleteProductDialog', () => ({ DeleteProductDialog: () => null }));
vi.mock('../components/ProductForm', () => ({ ProductForm: () => null }));

import ProductsPage from '../page';

const EMPTY = { items: [], total: 0, page: 1, page_size: 50, total_pages: 0 };

describe('ProductsPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows an error state, not "No products found", when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<ProductsPage />);

    expect(await screen.findByText("Couldn't load products")).toBeInTheDocument();
    expect(screen.queryByText('No products found')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows the genuine empty state when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<ProductsPage />);

    expect(await screen.findByText('No products found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load products")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<ProductsPage />);
    await screen.findByText("Couldn't load products");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue(EMPTY);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No products found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load products")).not.toBeInTheDocument();
  });
});

describe('ProductsPage header count after a failed load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('does not show a zero count when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<ProductsPage />);

    await screen.findByText("Couldn't load products");
    expect(screen.queryByText(/product SKUs in stock/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Updated .* ago/)).not.toBeInTheDocument();
  });

  it('still shows the zero count when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<ProductsPage />);

    expect(await screen.findByText('0 product SKUs in stock')).toBeInTheDocument();
  });
});
