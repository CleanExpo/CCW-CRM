import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get } = vi.hoisted(() => ({ toast: vi.fn(), get: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/invoices', () => ({ invoicesApi: { list: get } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/invoices',
}));
vi.mock('../components/RecordPaymentDialog', () => ({ RecordPaymentDialog: () => null }));
vi.mock('../components/InvoiceForm', () => ({ InvoiceForm: () => null }));
vi.mock('../components/DeleteInvoiceDialog', () => ({ DeleteInvoiceDialog: () => null }));
vi.mock('../components/FinancialReportTab', () => ({ FinancialReportTab: () => null }));
vi.mock('@/components/dashboard/ScanComingSoon', () => ({ ScanComingSoon: () => null }));

import InvoicesPage from '../page';

const EMPTY = { data: [], total: 0, page: 1, page_size: 50, total_pages: 0 };

describe('InvoicesPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows an error state, not "No invoices found", when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<InvoicesPage />);

    expect(await screen.findByText("Couldn't load invoices")).toBeInTheDocument();
    expect(screen.queryByText('No invoices found')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows the genuine empty state when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<InvoicesPage />);

    expect(await screen.findByText('No invoices found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load invoices")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<InvoicesPage />);
    await screen.findByText("Couldn't load invoices");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue(EMPTY);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No invoices found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load invoices")).not.toBeInTheDocument();
  });
});
