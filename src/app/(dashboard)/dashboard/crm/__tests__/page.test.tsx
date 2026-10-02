import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));

import CrmHubPage from '../page';

const ZERO = { customers: 0, contacts: 0, activities_last_30_days: 0, pending_tasks: 0 };

describe('CrmHubPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error state, not zero counts, when the overview load fails', async () => {
    get.mockRejectedValue(new Error('Network down'));

    render(<CrmHubPage />);

    expect(await screen.findByText("Couldn't load CRM overview")).toBeInTheDocument();
    expect(screen.queryByText('Active customers')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('still shows genuine zero counts when the load succeeds', async () => {
    get.mockResolvedValue(ZERO);

    render(<CrmHubPage />);

    expect(await screen.findByText('Active customers')).toBeInTheDocument();
    expect(screen.getAllByText('0')).toHaveLength(4);
    expect(screen.queryByText("Couldn't load CRM overview")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<CrmHubPage />);
    await screen.findByText("Couldn't load CRM overview");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue({ ...ZERO, customers: 7 });
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load CRM overview")).not.toBeInTheDocument();
  });
});
