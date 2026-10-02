import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CcwFeasibilityDashboardPage from '../page';

const fetchMock = vi.fn();

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EMPTY_TEXT = 'No saved feasibility statements yet.';

describe('CcwFeasibilityDashboardPage list load failure', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an error state, not "No saved feasibility statements yet.", when the list read fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<CcwFeasibilityDashboardPage />);

    expect(await screen.findByText("Couldn't load saved statements")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText('0 database-backed records')).not.toBeInTheDocument();
  });

  it('still shows the genuine empty state when the list read succeeds with no rows', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ items: [], total: 0 }));

    render(<CcwFeasibilityDashboardPage />);

    expect(await screen.findByText(EMPTY_TEXT)).toBeInTheDocument();
    expect(screen.getByText('0 database-backed records')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load saved statements")).not.toBeInTheDocument();
  });

  it('re-runs the list read when Retry is pressed', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<CcwFeasibilityDashboardPage />);
    await screen.findByText("Couldn't load saved statements");
    const callsBefore = fetchMock.mock.calls.length;

    fetchMock.mockImplementation(async () => jsonResponse({ items: [], total: 0 }));
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText(EMPTY_TEXT)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load saved statements")).not.toBeInTheDocument();
  });
});
