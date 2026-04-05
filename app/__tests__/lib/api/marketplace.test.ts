import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  getMarketplaceChannels,
  connectChannel,
  disconnectChannel,
  getChannelProducts,
  syncProducts,
  getSyncStatus,
  syncInventory,
  getMarketplaceOrders,
  getChannelSetupFields,
  marketplaceApi,
} from '@/lib/api/marketplace';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMarketplaceChannels', () => {
  it('calls GET /api/marketplace/channels', async () => {
    mockGet.mockResolvedValue({ channels: [], total: 0 });
    await getMarketplaceChannels();
    expect(mockGet).toHaveBeenCalledWith('/api/marketplace/channels');
  });
});

describe('connectChannel', () => {
  it('calls POST /api/marketplace/channels/:type/connect', async () => {
    mockPost.mockResolvedValue({
      success: true,
      channel_type: 'shopify',
      message: 'Connected',
      mode: 'demo',
    });
    await connectChannel('shopify', { api_key: 'test' });
    expect(mockPost).toHaveBeenCalledWith('/api/marketplace/channels/shopify/connect', {
      credentials: { api_key: 'test' },
    });
  });

  it('defaults credentials to empty object', async () => {
    mockPost.mockResolvedValue({ success: true });
    await connectChannel('ebay');
    expect(mockPost).toHaveBeenCalledWith('/api/marketplace/channels/ebay/connect', {
      credentials: {},
    });
  });
});

describe('disconnectChannel', () => {
  it('calls POST /api/marketplace/channels/:type/disconnect', async () => {
    mockPost.mockResolvedValue({ success: true });
    await disconnectChannel('shopify');
    expect(mockPost).toHaveBeenCalledWith('/api/marketplace/channels/shopify/disconnect');
  });
});

describe('getChannelProducts', () => {
  it('calls GET with default limit and offset', async () => {
    mockGet.mockResolvedValue([]);
    await getChannelProducts('shopify');
    expect(mockGet).toHaveBeenCalledWith(
      '/api/marketplace/channels/shopify/products?limit=50&offset=0'
    );
  });

  it('accepts custom limit and offset', async () => {
    mockGet.mockResolvedValue([]);
    await getChannelProducts('ebay', 10, 20);
    expect(mockGet).toHaveBeenCalledWith(
      '/api/marketplace/channels/ebay/products?limit=10&offset=20'
    );
  });
});

describe('syncProducts', () => {
  it('calls POST /api/marketplace/sync/products with channel_types', async () => {
    mockPost.mockResolvedValue({ success: true, results: {} });
    await syncProducts(['shopify', 'ebay']);
    expect(mockPost).toHaveBeenCalledWith('/api/marketplace/sync/products', {
      channel_types: ['shopify', 'ebay'],
    });
  });

  it('sends null channel_types when none specified', async () => {
    mockPost.mockResolvedValue({ success: true, results: {} });
    await syncProducts();
    expect(mockPost).toHaveBeenCalledWith('/api/marketplace/sync/products', {
      channel_types: null,
    });
  });
});

describe('getSyncStatus', () => {
  it('calls GET /api/marketplace/sync/status', async () => {
    mockGet.mockResolvedValue({ channels: {}, overall_healthy: true });
    await getSyncStatus();
    expect(mockGet).toHaveBeenCalledWith('/api/marketplace/sync/status');
  });
});

describe('syncInventory', () => {
  it('calls POST /api/marketplace/sync/inventory', async () => {
    mockPost.mockResolvedValue({ success: true, results: {} });
    const items = [{ external_id: 'ext-1', quantity: 10, channel_type: 'shopify' }];
    await syncInventory(items, ['shopify']);
    expect(mockPost).toHaveBeenCalledWith('/api/marketplace/sync/inventory', {
      items,
      channel_types: ['shopify'],
    });
  });
});

describe('getMarketplaceOrders', () => {
  it('calls GET /api/marketplace/orders with no params', async () => {
    mockGet.mockResolvedValue({ orders: [], total: 0, channels: [] });
    await getMarketplaceOrders();
    expect(mockGet).toHaveBeenCalledWith('/api/marketplace/orders');
  });

  it('appends channel_type filter', async () => {
    mockGet.mockResolvedValue({ orders: [], total: 0, channels: [] });
    await getMarketplaceOrders({ channel_type: 'ebay' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('channel_type=ebay'));
  });
});

describe('getChannelSetupFields', () => {
  it('calls GET /api/marketplace/channels/:type/setup-fields', async () => {
    mockGet.mockResolvedValue({ channel_type: 'shopify', fields: [] });
    await getChannelSetupFields('shopify');
    expect(mockGet).toHaveBeenCalledWith('/api/marketplace/channels/shopify/setup-fields');
  });
});

describe('marketplaceApi namespace', () => {
  it('exposes all functions', () => {
    expect(marketplaceApi.getChannels).toBe(getMarketplaceChannels);
    expect(marketplaceApi.connect).toBe(connectChannel);
    expect(marketplaceApi.disconnect).toBe(disconnectChannel);
    expect(marketplaceApi.getProducts).toBe(getChannelProducts);
    expect(marketplaceApi.syncProducts).toBe(syncProducts);
    expect(marketplaceApi.getSyncStatus).toBe(getSyncStatus);
    expect(marketplaceApi.syncInventory).toBe(syncInventory);
    expect(marketplaceApi.getOrders).toBe(getMarketplaceOrders);
    expect(marketplaceApi.getSetupFields).toBe(getChannelSetupFields);
  });
});
