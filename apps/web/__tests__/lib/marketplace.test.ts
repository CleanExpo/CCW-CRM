/**
 * Marketplace API Client Tests
 *
 * Tests the type-safe marketplace API client functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the apiClient before importing marketplace
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { apiClient } from '@/lib/api/client';
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

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Marketplace API Client', () => {
  describe('getMarketplaceChannels', () => {
    it('calls correct endpoint', async () => {
      mockGet.mockResolvedValue({ channels: [], total: 0 });
      await getMarketplaceChannels();
      expect(mockGet).toHaveBeenCalledWith('/api/marketplace/channels');
    });

    it('returns channel list', async () => {
      const mockData = {
        channels: [
          { channel_type: 'shopify', display_name: 'Shopify', connected: true, mode: 'demo' },
        ],
        total: 1,
      };
      mockGet.mockResolvedValue(mockData);
      const result = await getMarketplaceChannels();
      expect(result.total).toBe(1);
      expect(result.channels[0].channel_type).toBe('shopify');
    });
  });

  describe('connectChannel', () => {
    it('posts credentials to correct endpoint', async () => {
      mockPost.mockResolvedValue({ success: true, channel_type: 'shopify', message: 'ok' });
      await connectChannel('shopify', { shop_domain: 'test.myshopify.com' });
      expect(mockPost).toHaveBeenCalledWith('/api/marketplace/channels/shopify/connect', {
        credentials: { shop_domain: 'test.myshopify.com' },
      });
    });

    it('sends empty credentials by default', async () => {
      mockPost.mockResolvedValue({ success: true });
      await connectChannel('ebay');
      expect(mockPost).toHaveBeenCalledWith('/api/marketplace/channels/ebay/connect', {
        credentials: {},
      });
    });
  });

  describe('disconnectChannel', () => {
    it('posts to disconnect endpoint', async () => {
      mockPost.mockResolvedValue({ success: true });
      await disconnectChannel('facebook');
      expect(mockPost).toHaveBeenCalledWith('/api/marketplace/channels/facebook/disconnect');
    });
  });

  describe('getChannelProducts', () => {
    it('calls with default limit and offset', async () => {
      mockGet.mockResolvedValue([]);
      await getChannelProducts('shopify');
      expect(mockGet).toHaveBeenCalledWith(
        '/api/marketplace/channels/shopify/products?limit=50&offset=0'
      );
    });

    it('passes custom limit', async () => {
      mockGet.mockResolvedValue([]);
      await getChannelProducts('ebay', 10, 5);
      expect(mockGet).toHaveBeenCalledWith(
        '/api/marketplace/channels/ebay/products?limit=10&offset=5'
      );
    });
  });

  describe('syncProducts', () => {
    it('syncs all channels by default', async () => {
      mockPost.mockResolvedValue({ success: true, results: {}, synced_at: '' });
      await syncProducts();
      expect(mockPost).toHaveBeenCalledWith('/api/marketplace/sync/products', {
        channel_types: null,
      });
    });

    it('syncs specific channels', async () => {
      mockPost.mockResolvedValue({ success: true, results: {}, synced_at: '' });
      await syncProducts(['shopify']);
      expect(mockPost).toHaveBeenCalledWith('/api/marketplace/sync/products', {
        channel_types: ['shopify'],
      });
    });
  });

  describe('getSyncStatus', () => {
    it('calls sync status endpoint', async () => {
      mockGet.mockResolvedValue({ channels: {}, overall_healthy: true });
      await getSyncStatus();
      expect(mockGet).toHaveBeenCalledWith('/api/marketplace/sync/status');
    });
  });

  describe('syncInventory', () => {
    it('sends inventory items', async () => {
      mockPost.mockResolvedValue({ success: true, results: {} });
      const items = [{ external_id: 'x', quantity: 5, channel_type: 'shopify' }];
      await syncInventory(items);
      expect(mockPost).toHaveBeenCalledWith('/api/marketplace/sync/inventory', {
        items,
        channel_types: null,
      });
    });
  });

  describe('getMarketplaceOrders', () => {
    it('calls without params', async () => {
      mockGet.mockResolvedValue({ orders: [], total: 0, channels: [] });
      await getMarketplaceOrders();
      expect(mockGet).toHaveBeenCalledWith('/api/marketplace/orders');
    });

    it('passes channel_type filter', async () => {
      mockGet.mockResolvedValue({ orders: [], total: 0, channels: ['shopify'] });
      await getMarketplaceOrders({ channel_type: 'shopify' });
      expect(mockGet).toHaveBeenCalledWith('/api/marketplace/orders?channel_type=shopify');
    });

    it('passes since filter', async () => {
      mockGet.mockResolvedValue({ orders: [], total: 0, channels: [] });
      await getMarketplaceOrders({ since: '2026-01-01T00:00:00Z' });
      expect(mockGet).toHaveBeenCalledWith(
        '/api/marketplace/orders?since=2026-01-01T00%3A00%3A00Z'
      );
    });
  });

  describe('getChannelSetupFields', () => {
    it('calls correct endpoint', async () => {
      mockGet.mockResolvedValue({ channel_type: 'ebay', fields: [] });
      await getChannelSetupFields('ebay');
      expect(mockGet).toHaveBeenCalledWith('/api/marketplace/channels/ebay/setup-fields');
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
});
