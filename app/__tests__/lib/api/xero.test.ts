import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import {
  startXeroAuth,
  getXeroStatus,
  disconnectXero,
  syncOrderToXero,
  bulkSyncOrders,
  getXeroInvoice,
  isXeroConnected,
} from '@/lib/api/xero';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('startXeroAuth', () => {
  it('calls GET /api/integrations/xero/authorize', async () => {
    mockGet.mockResolvedValue({ authorization_url: 'https://xero.com/auth', state: 'abc' });
    await startXeroAuth();
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/xero/authorize');
  });
});

describe('getXeroStatus', () => {
  it('calls GET /api/integrations/xero/status', async () => {
    mockGet.mockResolvedValue({ connected: true, mode: 'demo' });
    await getXeroStatus();
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/xero/status');
  });
});

describe('disconnectXero', () => {
  it('calls POST /api/integrations/xero/disconnect', async () => {
    mockPost.mockResolvedValue({ success: true, message: 'Disconnected' });
    await disconnectXero();
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/xero/disconnect');
  });
});

describe('syncOrderToXero', () => {
  it('calls POST /api/integrations/xero/sync-order/:orderId', async () => {
    mockPost.mockResolvedValue({ success: true, xero_invoice_id: 'xi-1' });
    await syncOrderToXero('order-1');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/xero/sync-order/order-1');
  });
});

describe('bulkSyncOrders', () => {
  it('defaults max_orders to 100', async () => {
    mockPost.mockResolvedValue({ total: 5, synced: 5, failed: 0 });
    await bulkSyncOrders();
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/xero/sync-all?max_orders=100');
  });

  it('accepts custom max_orders', async () => {
    mockPost.mockResolvedValue({ total: 10, synced: 10, failed: 0 });
    await bulkSyncOrders(50);
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/xero/sync-all?max_orders=50');
  });
});

describe('getXeroInvoice', () => {
  it('calls GET /api/integrations/xero/invoice/:orderId', async () => {
    mockGet.mockResolvedValue({ invoice_id: 'xi-1', status: 'AUTHORISED' });
    await getXeroInvoice('order-1');
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/xero/invoice/order-1');
  });
});

describe('isXeroConnected', () => {
  it('returns true when connected', async () => {
    mockGet.mockResolvedValue({ connected: true, mode: 'demo' });
    const result = await isXeroConnected();
    expect(result).toBe(true);
  });

  it('returns false on error', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    const result = await isXeroConnected();
    expect(result).toBe(false);
  });
});
