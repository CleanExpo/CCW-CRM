import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/lib/api/client', () => ({ apiClient: { get } }));

import { LocationAwareProductSelect } from '../LocationAwareProductSelect';

const EMPTY_CATALOG = 'No products in catalog. Add products under Inventory.';
const EMPTY_SEARCH = 'No products match your search.';

beforeAll(() => {
  // Radix Popover and cmdk need these browser APIs, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

async function openSelect() {
  render(<LocationAwareProductSelect onSelect={vi.fn()} />);
  await userEvent.click(screen.getByRole('combobox'));
}

describe('LocationAwareProductSelect load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('says the catalog failed to load, not "No products in catalog", when the read fails', async () => {
    get.mockRejectedValue(new Error('Network down'));
    await openSelect();

    expect(await screen.findByText("Couldn't load products.")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_CATALOG)).not.toBeInTheDocument();
  });

  it('still says "No products in catalog" when the catalog is genuinely empty', async () => {
    get.mockResolvedValue({ items: [] });
    await openSelect();

    expect(await screen.findByText(EMPTY_CATALOG)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load products.")).not.toBeInTheDocument();
  });

  it('re-runs the catalog read when Retry is pressed', async () => {
    get.mockRejectedValue(new Error('Network down'));
    await openSelect();
    await screen.findByText("Couldn't load products.");
    const callsBefore = get.mock.calls.length;

    get.mockResolvedValue({ items: [] });
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText(EMPTY_CATALOG)).toBeInTheDocument();
  });

  it('says the search failed, not "No products match your search", when the search read fails', async () => {
    get.mockImplementation(async (url: string) => {
      if (url.includes('search=')) throw new Error('Network down');
      return { items: [] };
    });
    await openSelect();
    await screen.findByText(EMPTY_CATALOG);

    await userEvent.type(screen.getByPlaceholderText(/filter by sku/i), 'mop');

    expect(await screen.findByText("Couldn't search products.")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_SEARCH)).not.toBeInTheDocument();
  });

  it('drops the failed-search message as soon as the search term changes', async () => {
    let failSearch = true;
    get.mockImplementation(async (url: string) => {
      if (url.includes('search=') && failSearch) throw new Error('Network down');
      return { items: [] };
    });
    await openSelect();
    await screen.findByText(EMPTY_CATALOG);
    const input = screen.getByPlaceholderText(/filter by sku/i);
    await userEvent.type(input, 'mop');
    await screen.findByText("Couldn't search products.");

    failSearch = false;
    await userEvent.type(input, 'x');

    // Still inside the 280ms debounce: the old failure must not show against the new term,
    // and the new term must not be reported as matching nothing before it was searched.
    expect(screen.queryByText("Couldn't search products.")).not.toBeInTheDocument();
    expect(screen.queryByText(EMPTY_SEARCH)).not.toBeInTheDocument();
    expect(await screen.findByText(EMPTY_SEARCH)).toBeInTheDocument();
  });

  it('still says "No products match your search" when the search finds nothing', async () => {
    get.mockResolvedValue({ items: [] });
    await openSelect();
    await screen.findByText(EMPTY_CATALOG);

    await userEvent.type(screen.getByPlaceholderText(/filter by sku/i), 'mop');

    expect(await screen.findByText(EMPTY_SEARCH)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't search products.")).not.toBeInTheDocument();
  });
});
