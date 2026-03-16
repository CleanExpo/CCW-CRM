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
  getCin7Status,
  connectCin7,
  disconnectCin7,
  triggerCin7Sync,
  getCin7SyncLogs,
  getCin7StreamStats,
  getCin7PollStatus,
  triggerCin7Poll,
  getCin7SyncHealth,
  getOrderLineItems,
  getPurchaseOrderLineItems,
} from '@/lib/api/cin7';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCin7Status', () => {
  it('calls GET /api/integrations/cin7/status', async () => {
    const mockStatus = {
      connected: true,
      mode: 'demo',
      core_connected: true,
      omni_connected: false,
    };
    mockGet.mockResolvedValue(mockStatus);
    const result = await getCin7Status();
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/cin7/status');
    expect(result.connected).toBe(true);
  });
});

describe('connectCin7', () => {
  it('calls POST /api/integrations/cin7/connect', async () => {
    mockPost.mockResolvedValue({ connected: true, mode: 'demo' });
    await connectCin7();
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/cin7/connect');
  });
});

describe('disconnectCin7', () => {
  it('calls POST /api/integrations/cin7/disconnect', async () => {
    mockPost.mockResolvedValue({ status: 'disconnected' });
    await disconnectCin7();
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/cin7/disconnect');
  });
});

describe('triggerCin7Sync', () => {
  it('calls POST /api/integrations/cin7/sync/products', async () => {
    mockPost.mockResolvedValue({ status: 'synced', records_processed: 10 });
    await triggerCin7Sync('products');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/cin7/sync/products');
  });

  it('calls POST /api/integrations/cin7/sync/inventory', async () => {
    mockPost.mockResolvedValue({ status: 'synced', records_processed: 5 });
    await triggerCin7Sync('inventory');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/cin7/sync/inventory');
  });
});

describe('getCin7SyncLogs', () => {
  it('calls GET with default limit of 20', async () => {
    mockGet.mockResolvedValue({ logs: [] });
    await getCin7SyncLogs();
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/cin7/sync/logs?limit=20');
  });

  it('calls GET with custom limit', async () => {
    mockGet.mockResolvedValue({ logs: [] });
    await getCin7SyncLogs(50);
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/cin7/sync/logs?limit=50');
  });
});

describe('getCin7StreamStats', () => {
  it('calls GET /api/integrations/cin7/stream/stats', async () => {
    mockGet.mockResolvedValue({ channel: 'cin7', active_connections: 0 });
    await getCin7StreamStats();
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/cin7/stream/stats');
  });
});

describe('getCin7PollStatus', () => {
  it('calls GET /api/integrations/cin7/poll/status', async () => {
    mockGet.mockResolvedValue({ polling_enabled: true });
    await getCin7PollStatus();
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/cin7/poll/status');
  });
});

describe('triggerCin7Poll', () => {
  it('defaults to core source', async () => {
    mockPost.mockResolvedValue({ total_changes: 3, duration_ms: 150 });
    await triggerCin7Poll();
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/cin7/poll?source=core');
  });

  it('accepts omni source', async () => {
    mockPost.mockResolvedValue({ total_changes: 1, duration_ms: 200 });
    await triggerCin7Poll('omni');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/cin7/poll?source=omni');
  });
});

describe('getCin7SyncHealth', () => {
  it('calls GET /api/ai/cin7-anomaly/sync-health', async () => {
    mockGet.mockResolvedValue({ score: 95, grade: 'A' });
    await getCin7SyncHealth();
    expect(mockGet).toHaveBeenCalledWith('/api/ai/cin7-anomaly/sync-health');
  });
});

describe('getOrderLineItems', () => {
  it('calls GET /api/cin7/orders/:id/line-items', async () => {
    mockGet.mockResolvedValue({ mapping_id: 'm-1', line_items: [], total_items: 0 });
    await getOrderLineItems('m-1');
    expect(mockGet).toHaveBeenCalledWith('/api/cin7/orders/m-1/line-items');
  });
});

describe('getPurchaseOrderLineItems', () => {
  it('calls GET /api/cin7/purchase-orders/:id/line-items', async () => {
    mockGet.mockResolvedValue({ mapping_id: 'po-1', line_items: [], total_items: 0 });
    await getPurchaseOrderLineItems('po-1');
    expect(mockGet).toHaveBeenCalledWith('/api/cin7/purchase-orders/po-1/line-items');
  });
});
