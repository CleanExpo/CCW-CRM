import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, get } = vi.hoisted(() => ({ toast: vi.fn(), get: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/client', () => ({ apiClient: { get, post: vi.fn() } }));
vi.mock('@/lib/api/bank-reconciliation', () => ({ importCdrCsv: vi.fn() }));

import BankFeedsPage from '../page';

const STATS = {
  total_transactions: 10,
  auto_matched: 8,
  manual_matched: 2,
  unmatched: 0,
  reconciliation_rate: 100,
  date_range: { start_date: '2026-09-01', end_date: '2026-09-21' },
};

type Source = 'unreconciled' | 'accounts' | 'stats' | 'alerts';

/** Every source resolves empty unless it is listed as failing. */
function respond(failing: Source[] = []) {
  get.mockImplementation((url: string) => {
    const source = (['unreconciled', 'accounts', 'stats', 'alerts'] as Source[]).find((s) =>
      url.includes(`/api/bank-feeds/${s}`)
    );
    if (!source) return Promise.reject(new Error(`unexpected url ${url}`));
    if (failing.includes(source)) return Promise.reject(new Error('Network down'));
    return Promise.resolve(source === 'stats' ? STATS : []);
  });
}

describe('BankFeedsPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never says "All transactions reconciled" when the unreconciled fetch failed', async () => {
    respond(['unreconciled']);

    render(<BankFeedsPage />);

    expect(await screen.findByText("Couldn't load unreconciled transactions")).toBeInTheDocument();
    expect(screen.queryByText('All transactions reconciled')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('shows which other sources failed instead of hiding them', async () => {
    respond(['accounts', 'stats', 'alerts']);

    render(<BankFeedsPage />);

    expect(await screen.findByText("Couldn't load reconciliation stats")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load bank accounts")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load reconciliation alerts")).toBeInTheDocument();
  });

  it('still says "All transactions reconciled" when every fetch succeeds with nothing unmatched', async () => {
    respond();

    render(<BankFeedsPage />);

    expect(await screen.findByText('All transactions reconciled')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    respond(['unreconciled']);
    render(<BankFeedsPage />);
    await screen.findByText("Couldn't load unreconciled transactions");
    const callsBefore = get.mock.calls.length;

    respond();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('All transactions reconciled')).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/i)).not.toBeInTheDocument();
  });
});
