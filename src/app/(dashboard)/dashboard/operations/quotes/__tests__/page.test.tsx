import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get } = vi.hoisted(() => ({ toast: vi.fn(), get: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard/operations/quotes',
}));
vi.mock('../components/QuoteForm', () => ({ QuoteForm: () => null }));
vi.mock('../components/DeleteQuoteDialog', () => ({ DeleteQuoteDialog: () => null }));
vi.mock('../components/ConvertToOrderDialog', () => ({ ConvertToOrderDialog: () => null }));

import QuotesPage from '../page';

const EMPTY = { items: [], total: 0, page: 1, page_size: 50, total_pages: 0 };

describe('QuotesPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows an error state, not "No quotes yet", when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<QuotesPage />);

    expect(await screen.findByText("Couldn't load quotes")).toBeInTheDocument();
    expect(screen.queryByText('No quotes yet')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows the genuine empty state when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<QuotesPage />);

    expect(await screen.findByText('No quotes yet')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load quotes")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<QuotesPage />);
    await screen.findByText("Couldn't load quotes");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue(EMPTY);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No quotes yet')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load quotes")).not.toBeInTheDocument();
  });
});

describe('QuotesPage header count after a failed load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('does not show a zero count when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<QuotesPage />);

    await screen.findByText("Couldn't load quotes");
    expect(screen.queryByText(/quotes in system/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Updated .* ago/)).not.toBeInTheDocument();
  });

  it('still shows the zero count when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<QuotesPage />);

    expect(await screen.findByText('0 quotes in system')).toBeInTheDocument();
  });
});
