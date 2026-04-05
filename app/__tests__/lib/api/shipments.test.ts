import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { shipmentsApi } from '@/lib/api/shipments';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

const mockShipment = {
  id: 'ship-1',
  shipment_number: 'SHP-2026-001',
  order_id: 'order-1',
  status: 'pending' as const,
  carrier_name: 'StarTrack',
  tracking_number: 'ST123456789AU',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockPaginated = {
  items: [mockShipment],
  total: 1,
  page: 1,
  page_size: 50,
  total_pages: 1,
};

// ─── shipmentsApi.list ─────────────────────────────

describe('shipmentsApi.list', () => {
  it('calls GET /api/shipments with no params', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await shipmentsApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/shipments?');
  });

  it('appends status filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await shipmentsApi.list({ status: 'in_transit' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('status=in_transit'));
  });

  it('appends carrier filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await shipmentsApi.list({ carrier: 'StarTrack' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('carrier=StarTrack'));
  });

  it('appends order_id filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await shipmentsApi.list({ order_id: 'order-99' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('order_id=order-99'));
  });

  it('returns paginated shipments response', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    const result = await shipmentsApi.list();
    expect(result.items[0].shipment_number).toBe('SHP-2026-001');
    expect(result.total).toBe(1);
  });
});

// ─── shipmentsApi.get ──────────────────────────────

describe('shipmentsApi.get', () => {
  it('calls GET /api/shipments/:id', async () => {
    mockGet.mockResolvedValue(mockShipment);
    await shipmentsApi.get('ship-1');
    expect(mockGet).toHaveBeenCalledWith('/api/shipments/ship-1');
  });

  it('returns the shipment', async () => {
    mockGet.mockResolvedValue(mockShipment);
    const result = await shipmentsApi.get('ship-1');
    expect(result.carrier_name).toBe('StarTrack');
    expect(result.tracking_number).toBe('ST123456789AU');
  });
});

// ─── shipmentsApi.create ───────────────────────────

describe('shipmentsApi.create', () => {
  it('calls POST /api/shipments with data', async () => {
    mockPost.mockResolvedValue(mockShipment);
    const payload = {
      order_id: 'order-1',
      carrier_name: 'StarTrack',
      tracking_number: 'ST123456789AU',
    };
    await shipmentsApi.create(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/shipments', payload);
  });

  it('returns created shipment', async () => {
    mockPost.mockResolvedValue(mockShipment);
    const result = await shipmentsApi.create({
      order_id: 'order-1',
      carrier_name: 'StarTrack',
      tracking_number: 'ST123456789AU',
    });
    expect(result.id).toBe('ship-1');
  });
});

// ─── shipmentsApi.update ───────────────────────────

describe('shipmentsApi.update', () => {
  it('calls PUT /api/shipments/:id with update data', async () => {
    mockPut.mockResolvedValue(mockShipment);
    const update = { status: 'in_transit' as const, actual_delivery_date: undefined };
    await shipmentsApi.update('ship-1', update);
    expect(mockPut).toHaveBeenCalledWith('/api/shipments/ship-1', update);
  });
});

// ─── shipmentsApi.delete ───────────────────────────

describe('shipmentsApi.delete', () => {
  it('calls DELETE /api/shipments/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await shipmentsApi.delete('ship-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/shipments/ship-1');
  });
});

// ─── shipmentsApi.updateTracking ──────────────────

describe('shipmentsApi.updateTracking', () => {
  it('calls POST /api/shipments/:id/track with tracking data', async () => {
    const updatedShipment = { ...mockShipment, status: 'in_transit' as const };
    mockPost.mockResolvedValue(updatedShipment);
    const trackingData = {
      status: 'in_transit' as const,
      location: 'Brisbane DC',
      timestamp: '2026-01-02T09:00:00Z',
    };
    await shipmentsApi.updateTracking('ship-1', trackingData);
    expect(mockPost).toHaveBeenCalledWith('/api/shipments/ship-1/track', trackingData);
  });

  it('returns updated shipment', async () => {
    const updatedShipment = { ...mockShipment, status: 'delivered' as const };
    mockPost.mockResolvedValue(updatedShipment);
    const result = await shipmentsApi.updateTracking('ship-1', { status: 'delivered' });
    expect(result.status).toBe('delivered');
  });
});
