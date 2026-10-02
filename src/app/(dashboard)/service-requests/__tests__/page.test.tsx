import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get } = vi.hoisted(() => ({ toast: vi.fn(), get: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));
vi.mock('../components/ServiceRequestForm', () => ({ ServiceRequestForm: () => null }));
vi.mock('../components/DeleteServiceRequestDialog', () => ({
  DeleteServiceRequestDialog: () => null,
}));

import ServiceRequestsPage from '../page';

const EMPTY = { items: [], total: 0, page: 1, page_size: 50, total_pages: 0 };

describe('ServiceRequestsPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('shows an error state, not "No service requests found", when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<ServiceRequestsPage />);

    expect(await screen.findByText("Couldn't load service requests")).toBeInTheDocument();
    expect(screen.queryByText('No service requests found')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows the genuine empty state when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<ServiceRequestsPage />);

    expect(await screen.findByText('No service requests found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load service requests")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<ServiceRequestsPage />);
    await screen.findByText("Couldn't load service requests");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue(EMPTY);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No service requests found')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load service requests")).not.toBeInTheDocument();
  });
});

describe('ServiceRequestsPage header count after a failed load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('does not show a zero count when the load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<ServiceRequestsPage />);

    await screen.findByText("Couldn't load service requests");
    expect(screen.queryByText(/requests total/)).not.toBeInTheDocument();
  });

  it('still shows the zero count when the load succeeds with no rows', async () => {
    get.mockResolvedValue(EMPTY);

    render(<ServiceRequestsPage />);

    expect(await screen.findByText('0 requests total')).toBeInTheDocument();
  });
});
