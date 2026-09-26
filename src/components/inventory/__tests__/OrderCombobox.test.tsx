import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { list, get } = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));

vi.mock('@/lib/api/orders', () => ({ ordersApi: { list, get } }));

import { OrderCombobox } from '../OrderCombobox';

const EMPTY_LIST = 'No orders yet. Create one under Operations → Orders.';
const EMPTY_SEARCH = 'No orders match that search.';
const EMPTY_PAGE = { items: [], total: 0, page: 1, page_size: 100, total_pages: 0 };

beforeAll(() => {
  // Radix Popover and cmdk need these browser APIs, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

async function openCombobox() {
  render(<OrderCombobox onSelect={vi.fn()} />);
  await userEvent.click(screen.getByRole('combobox'));
}

describe('OrderCombobox load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('says the orders failed to load, not "No orders yet", when the read fails', async () => {
    list.mockRejectedValue(new Error('Network down'));
    await openCombobox();

    expect(await screen.findByText("Couldn't load orders.")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_LIST)).not.toBeInTheDocument();
  });

  it('still says "No orders yet" when there genuinely are none', async () => {
    list.mockResolvedValue(EMPTY_PAGE);
    await openCombobox();

    expect(await screen.findByText(EMPTY_LIST)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load orders.")).not.toBeInTheDocument();
  });

  it('re-runs the orders read when Retry is pressed', async () => {
    list.mockRejectedValue(new Error('Network down'));
    await openCombobox();
    await screen.findByText("Couldn't load orders.");
    const callsBefore = list.mock.calls.length;

    list.mockResolvedValue(EMPTY_PAGE);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText(EMPTY_LIST)).toBeInTheDocument();
  });

  it('says the search failed, not "No orders match that search", when the search read fails', async () => {
    list.mockImplementation(async (params: { search?: string }) => {
      if (params.search) throw new Error('Network down');
      return EMPTY_PAGE;
    });
    await openCombobox();
    await screen.findByText(EMPTY_LIST);

    await userEvent.type(screen.getByPlaceholderText(/filter by order number/i), 'SO-1');

    expect(await screen.findByText("Couldn't search orders.")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_SEARCH)).not.toBeInTheDocument();
  });

  it('does not stay stuck loading when the search is cleared while a search is in flight', async () => {
    let resolveSearch: (page: typeof EMPTY_PAGE) => void = () => {};
    list.mockImplementation((params: { search?: string }) =>
      params.search
        ? new Promise<typeof EMPTY_PAGE>((resolve) => {
            resolveSearch = resolve;
          })
        : Promise.resolve(EMPTY_PAGE)
    );
    await openCombobox();
    await screen.findByText(EMPTY_LIST);
    const input = screen.getByPlaceholderText(/filter by order number/i);

    await userEvent.type(input, 'SO');
    await screen.findByText('Loading orders…');
    await userEvent.clear(input);
    resolveSearch(EMPTY_PAGE);

    expect(await screen.findByText(EMPTY_LIST)).toBeInTheDocument();
    expect(screen.queryByText('Loading orders…')).not.toBeInTheDocument();
  });

  it('still says "No orders match that search" when the search finds nothing', async () => {
    list.mockResolvedValue(EMPTY_PAGE);
    await openCombobox();
    await screen.findByText(EMPTY_LIST);

    await userEvent.type(screen.getByPlaceholderText(/filter by order number/i), 'SO-1');

    expect(await screen.findByText(EMPTY_SEARCH)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't search orders.")).not.toBeInTheDocument();
  });
});
