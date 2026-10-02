import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, listGoodsReceipts } = vi.hoisted(() => ({
  toast: vi.fn(),
  listGoodsReceipts: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/cin7-grn', () => ({ cin7GrnApi: { listGoodsReceipts } }));

import GoodsReceivingPage from '../page';

const EMPTY_TEXT = /No goods receipts yet/;

describe('GoodsReceivingPage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error state, not "No goods receipts yet", when the load fails', async () => {
    listGoodsReceipts.mockRejectedValue(new Error('Network down'));

    render(<GoodsReceivingPage />);

    expect(await screen.findByText("Couldn't load goods receipts")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_TEXT)).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows the genuine empty state when the load succeeds with no rows', async () => {
    listGoodsReceipts.mockResolvedValue({ items: [] });

    render(<GoodsReceivingPage />);

    expect(await screen.findByText(EMPTY_TEXT)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load goods receipts")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    listGoodsReceipts.mockRejectedValue(new Error('Network down'));
    render(<GoodsReceivingPage />);
    await screen.findByText("Couldn't load goods receipts");
    const callsBefore = listGoodsReceipts.mock.calls.length;

    listGoodsReceipts.mockResolvedValue({ items: [] });
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(listGoodsReceipts.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText(EMPTY_TEXT)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load goods receipts")).not.toBeInTheDocument();
  });
});
