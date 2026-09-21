/**
 * UNI-2688: the invoices list covers every CCW sale (equipment and
 * consumables), so it says "invoices", not "equipment invoices".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/invoices',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/invoices', () => ({
  invoicesApi: { list: vi.fn(), get: vi.fn() },
}));

vi.mock('../components/RecordPaymentDialog', () => ({ RecordPaymentDialog: () => null }));
vi.mock('../components/InvoiceForm', () => ({ InvoiceForm: () => null }));
vi.mock('../components/DeleteInvoiceDialog', () => ({ DeleteInvoiceDialog: () => null }));
vi.mock('../components/FinancialReportTab', () => ({ FinancialReportTab: () => null }));
vi.mock('@/components/dashboard/ScanComingSoon', () => ({ ScanComingSoon: () => null }));

import { invoicesApi } from '@/lib/api/invoices';
import InvoicesPage from '../page';

const mockList = invoicesApi.list as ReturnType<typeof vi.fn>;

describe('Invoices page wording (UNI-2688)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockList.mockResolvedValue({ data: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
  });

  it('says invoices, not equipment invoices, in the title, card and empty state', async () => {
    render(<InvoicesPage />);

    expect(await screen.findByText('No invoices found')).toBeInTheDocument();
    expect(screen.getByText('Create your first invoice to get started')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Invoices' })).toBeInTheDocument();
    expect(screen.getByText('Manage invoices and customer payments')).toBeInTheDocument();
    expect(screen.queryByText(/equipment/i)).not.toBeInTheDocument();
  });
});
