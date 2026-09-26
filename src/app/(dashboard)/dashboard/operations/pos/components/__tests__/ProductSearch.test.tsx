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

  it('drops the failed-search message as soon as the search term changes', async () => {
    get.mockRejectedValue(new Error('Network down'));
    render(<ProductSearch onAddProduct={vi.fn()} />);
    const input = screen.getByPlaceholderText(/search by sku/i);
    await userEvent.type(input, 'mop');
    await screen.findByText("Couldn't search products");

    get.mockResolvedValue({ items: [], total: 0 });
    await userEvent.type(input, 'x');

    // Still inside the 300ms debounce: the old failure must not show against the new term,
    // and the old term must not be reported as having no products.
    expect(screen.queryByText("Couldn't search products")).not.toBeInTheDocument();
    expect(screen.queryByText(/No products found/)).not.toBeInTheDocument();
    expect(await screen.findByText('No products found for "mopx"')).toBeInTheDocument();
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
