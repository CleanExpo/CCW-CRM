import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { toast, getChannels, getSyncStatus, getOrders, getProducts } = vi.hoisted(() => ({
  toast: vi.fn(),
  getChannels: vi.fn(),
  getSyncStatus: vi.fn(),
  getOrders: vi.fn(),
  getProducts: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api/marketplace', () => ({
  marketplaceApi: { getChannels, getSyncStatus, getOrders, getProducts },
}));

import MarketplacePage from '../page';

const SHOPIFY = {
  channel_type: 'shopify',
  display_name: 'Shopify',
  connected: true,
  mode: 'live',
  status: 'connected',
  last_product_sync: null,
  last_inventory_sync: null,
  last_order_sync: null,
  setup_fields: [],
};

function loadsWith(channels: unknown[]) {
  getChannels.mockResolvedValue({ channels });
  getSyncStatus.mockResolvedValue({ channels: {} });
  getOrders.mockResolvedValue({ orders: [] });
}

describe('MarketplacePage load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error state, not zero channels and orders, when the load fails', async () => {
    getChannels.mockRejectedValue(new Error('Network down'));
    getSyncStatus.mockResolvedValue({ channels: {} });
    getOrders.mockResolvedValue({ orders: [] });

    render(<MarketplacePage />);

    expect(await screen.findByText("Couldn't load marketplace channels")).toBeInTheDocument();
    expect(screen.queryByText('Channels (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('Orders (0)')).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('still shows zero counts when the load succeeds with nothing connected', async () => {
    loadsWith([]);

    render(<MarketplacePage />);

    expect(await screen.findByText('Channels (0)')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load marketplace channels")).not.toBeInTheDocument();
  });

  it('re-runs the load when Retry is pressed', async () => {
    getChannels.mockRejectedValue(new Error('Network down'));
    getSyncStatus.mockResolvedValue({ channels: {} });
    getOrders.mockResolvedValue({ orders: [] });
    render(<MarketplacePage />);
    await screen.findByText("Couldn't load marketplace channels");
    const callsBefore = getChannels.mock.calls.length;

    loadsWith([SHOPIFY]);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(getChannels.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(await screen.findByText('Channels (1)')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load marketplace channels")).not.toBeInTheDocument();
  });
});

describe('MarketplacePage channel products load failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadsWith([SHOPIFY]);
  });

  it('says the products failed to load, not "No products listed", when the read fails', async () => {
    getProducts.mockRejectedValue(new Error('Network down'));
    render(<MarketplacePage />);

    await screen.findByText('Shopify');
    await userEvent.click(screen.getByRole('button', { name: /^products$/i }));

    expect(await screen.findByText("Couldn't load products for this channel")).toBeInTheDocument();
    expect(screen.queryByText('No products listed on this channel.')).not.toBeInTheDocument();
  });

  it('still says "No products listed" when the channel genuinely has none', async () => {
    getProducts.mockResolvedValue([]);
    render(<MarketplacePage />);

    await screen.findByText('Shopify');
    await userEvent.click(screen.getByRole('button', { name: /^products$/i }));

    expect(await screen.findByText('No products listed on this channel.')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load products for this channel")).not.toBeInTheDocument();
  });

  it('re-runs the products read when Retry is pressed', async () => {
    getProducts.mockRejectedValue(new Error('Network down'));
    render(<MarketplacePage />);
    await screen.findByText('Shopify');
    await userEvent.click(screen.getByRole('button', { name: /^products$/i }));
    await screen.findByText("Couldn't load products for this channel");

    getProducts.mockResolvedValue([]);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(getProducts).toHaveBeenCalledTimes(2));
    expect(getProducts).toHaveBeenLastCalledWith('shopify');
    expect(await screen.findByText('No products listed on this channel.')).toBeInTheDocument();
  });
});
