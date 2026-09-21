import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get } = vi.hoisted(() => ({ toast: vi.fn(), get: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/contacts', () => ({ contactsApi: { list: get } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/contacts',
}));
vi.mock('../components/ContactForm', () => ({ ContactForm: () => null }));
vi.mock('../components/DeleteContactDialog', () => ({ DeleteContactDialog: () => null }));

import ContactsPage from '../page';

const EMPTY = { data: [], total: 0, page: 1, page_size: 50, total_pages: 0 };

describe('ContactsPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows an error state, not "No contacts found", when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<ContactsPage />);

    expect(await screen.findByText("Couldn't load contacts")).toBeInTheDocument();
    expect(screen.queryByText('No contacts found')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows the genuine empty state when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<ContactsPage />);

    expect(await screen.findByText('No contacts found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load contacts")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<ContactsPage />);
    await screen.findByText("Couldn't load contacts");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue(EMPTY);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No contacts found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load contacts")).not.toBeInTheDocument();
  });
});

describe('ContactsPage header count after a failed load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('does not show a zero count when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<ContactsPage />);

    await screen.findByText("Couldn't load contacts");
    expect(screen.queryByText(/contacts? found/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Updated .* ago/)).not.toBeInTheDocument();
  });

  it('still shows the zero count when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<ContactsPage />);

    expect(await screen.findByText('0 contacts found')).toBeInTheDocument();
  });
});
