import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ApiClientError: class extends Error {
    constructor(
      message: string,
      public status: number
    ) {
      super(message);
      this.name = 'ApiClientError';
    }
  },
}));

import {
  getShopifyStatus,
  connectShopify,
  disconnectShopify,
  importShopifyOrder,
  importRecentShopifyOrders,
  syncProductInventory,
  syncAllInventory,
  syncProductToShopify,
  isShopifyConnected,
} from '@/lib/api/shopify';
import { apiClient, ApiClientError } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getShopifyStatus', () => {
  it('calls GET /api/integrations/shopify/status', async () => {
    mockGet.mockResolvedValue({ connected: true, mode: 'demo' });
    await getShopifyStatus();
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/shopify/status');
  });
});

describe('connectShopify', () => {
  it('calls POST /api/integrations/shopify/connect', async () => {
    mockPost.mockResolvedValue({ success: true, mode: 'demo' });
    await connectShopify();
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/shopify/connect');
  });
});

describe('disconnectShopify', () => {
  it('calls POST /api/integrations/shopify/disconnect', async () => {
    mockPost.mockResolvedValue({ success: true, message: 'Disconnected' });
    await disconnectShopify();
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/shopify/disconnect');
  });
});

describe('importShopifyOrder', () => {
  it('calls POST /api/integrations/shopify/import-order/:id', async () => {
    mockPost.mockResolvedValue({ success: true, order_id: 'o-1' });
    await importShopifyOrder('12345');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/shopify/import-order/12345');
  });
});

describe('importRecentShopifyOrders', () => {
  it('defaults max_orders to 50', async () => {
    mockPost.mockResolvedValue({ success: true, imported_count: 5, orders: [] });
    await importRecentShopifyOrders();
    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('max_orders=50'));
  });

  it('appends created_after when provided', async () => {
    mockPost.mockResolvedValue({ success: true, imported_count: 3, orders: [] });
    await importRecentShopifyOrders(10, '2026-01-01');
    const url = mockPost.mock.calls[0][0];
    expect(url).toContain('max_orders=10');
    expect(url).toContain('created_after=2026-01-01');
  });
});

describe('syncProductInventory', () => {
  it('calls POST /api/integrations/shopify/sync-inventory/:productId', async () => {
    mockPost.mockResolvedValue({ success: true, product_id: 'p-1' });
    await syncProductInventory('p-1');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/shopify/sync-inventory/p-1');
  });
});

describe('syncAllInventory', () => {
  it('calls POST /api/integrations/shopify/sync-all-inventory', async () => {
    mockPost.mockResolvedValue({ success: true, total: 10, synced: 10, failed: 0 });
    await syncAllInventory();
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/shopify/sync-all-inventory');
  });
});

describe('syncProductToShopify', () => {
  it('calls POST /api/integrations/shopify/sync-product/:productId', async () => {
    mockPost.mockResolvedValue({ success: true, product_id: 'p-1' });
    await syncProductToShopify('p-1');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/shopify/sync-product/p-1');
  });
});

describe('isShopifyConnected', () => {
  it('returns true when connected', async () => {
    mockGet.mockResolvedValue({ connected: true });
    const result = await isShopifyConnected();
    expect(result).toBe(true);
  });

  it('returns false on 404', async () => {
    mockGet.mockRejectedValue(new ApiClientError('Not found', 404));
    const result = await isShopifyConnected();
    expect(result).toBe(false);
  });

  it('throws on non-404 errors', async () => {
    mockGet.mockRejectedValue(new ApiClientError('Server error', 500));
    await expect(isShopifyConnected()).rejects.toThrow('Server error');
  });
});
