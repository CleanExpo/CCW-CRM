import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));

import { ProductSearch } from '../ProductSearch';

describe('ProductSearch load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('says the search failed, not "No products found", when the read fails', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<ProductSearch onAddProduct={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/search by sku/i), 'mop');

    expect(await screen.findByText("Couldn't search products")).toBeInTheDocument();
    expect(screen.queryByText(/No products found/)).not.toBeInTheDocument();
  });

  it('still says "No products found" when the search succeeds with no rows', async () => {
    get.mockResolvedValue({ items: [], total: 0 });
    render(<ProductSearch onAddProduct={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/search by sku/i), 'mop');

    expect(await screen.findByText('No products found for "mop"')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't search products")).not.toBeInTheDocument();
  });

  it('re-runs the search when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<ProductSearch onAddProduct={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/search by sku/i), 'mop');
    await screen.findByText("Couldn't search products");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue({ items: [], total: 0 });
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('No products found for "mop"')).toBeInTheDocument();
  });
});
