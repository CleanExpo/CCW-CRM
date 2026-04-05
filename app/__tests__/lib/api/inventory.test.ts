import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { inventoryApi } from '@/lib/api/inventory';
import { apiClient } from '@/lib/api/client';
import { StoreLocation, AdjustmentType } from '@/lib/types/inventory';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => vi.clearAllMocks());

const mockInventoryItem = {
  id: 'inv-1',
  product_id: 'prod-1',
  sku: 'CCW-001',
  name: 'Power Drill',
  stock: 50,
  reserved: 5,
  available: 45,
  location: 'warehouse-a',
};

const mockPaginated = {
  items: [mockInventoryItem],
  total: 1,
  page: 1,
  page_size: 50,
  total_pages: 1,
};

// ─── inventoryApi.list ─────────────────────────────

describe('inventoryApi.list', () => {
  it('calls GET /api/inventory with no params', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await inventoryApi.list();
    expect(mockGet).toHaveBeenCalledWith('/api/inventory?');
  });

  it('appends page filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await inventoryApi.list({ page: 2 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page=2'));
  });

  it('appends search filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await inventoryApi.list({ search: 'drill' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('search=drill'));
  });

  it('appends location filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await inventoryApi.list({ location: 'warehouse-a' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('location=warehouse-a'));
  });

  it('appends low_stock=true filter', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    await inventoryApi.list({ low_stock: true });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('low_stock=true'));
  });

  it('returns paginated inventory response', async () => {
    mockGet.mockResolvedValue(mockPaginated);
    const result = await inventoryApi.list();
    expect(result.items[0].sku).toBe('CCW-001');
    expect(result.total).toBe(1);
  });
});

// ─── inventoryApi.getStockByLocation ──────────────

describe('inventoryApi.getStockByLocation', () => {
  it('calls GET /api/inventory/by-location with location param', async () => {
    mockGet.mockResolvedValue({
      location: 'warehouse-a',
      items: [],
      total: 0,
      page: 1,
      page_size: 50,
    });
    await inventoryApi.getStockByLocation('warehouse-a');
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/api/inventory/by-location'));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('location=warehouse-a'));
  });

  it('appends pagination params', async () => {
    mockGet.mockResolvedValue({
      location: 'warehouse-a',
      items: [],
      total: 0,
      page: 1,
      page_size: 10,
    });
    await inventoryApi.getStockByLocation('warehouse-a', { page: 1, page_size: 10 });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('page_size=10'));
  });
});

// ─── inventoryApi.getLowStock ──────────────────────

describe('inventoryApi.getLowStock', () => {
  it('calls GET /api/inventory/low-stock with default threshold 20', async () => {
    mockGet.mockResolvedValue([]);
    await inventoryApi.getLowStock();
    expect(mockGet).toHaveBeenCalledWith('/api/inventory/low-stock?threshold=20');
  });

  it('uses custom threshold', async () => {
    mockGet.mockResolvedValue([]);
    await inventoryApi.getLowStock(5);
    expect(mockGet).toHaveBeenCalledWith('/api/inventory/low-stock?threshold=5');
  });
});

// ─── inventoryApi.getStockHealth ──────────────────

describe('inventoryApi.getStockHealth', () => {
  it('calls GET /api/inventory/stock-health with default threshold', async () => {
    mockGet.mockResolvedValue({});
    await inventoryApi.getStockHealth();
    expect(mockGet).toHaveBeenCalledWith('/api/inventory/stock-health?threshold=20');
  });
});

// ─── inventoryApi.getTransferSuggestions ──────────

describe('inventoryApi.getTransferSuggestions', () => {
  it('calls GET /api/inventory/transfer-suggestions', async () => {
    mockGet.mockResolvedValue([]);
    await inventoryApi.getTransferSuggestions();
    expect(mockGet).toHaveBeenCalledWith('/api/inventory/transfer-suggestions');
  });
});

// ─── inventoryApi.getProductStock ─────────────────

describe('inventoryApi.getProductStock', () => {
  it('calls GET /api/inventory/product/:id/locations', async () => {
    mockGet.mockResolvedValue([]);
    await inventoryApi.getProductStock('prod-1');
    expect(mockGet).toHaveBeenCalledWith('/api/inventory/product/prod-1/locations');
  });
});

// ─── inventoryApi.createTransfer ──────────────────

describe('inventoryApi.createTransfer', () => {
  it('calls POST /api/inventory/transfer', async () => {
    const mockTransfer = { id: 'transfer-1', status: 'pending' };
    mockPost.mockResolvedValue(mockTransfer);
    const payload = {
      product_id: 'prod-1',
      from_location: StoreLocation.BRISBANE,
      to_location: StoreLocation.SYDNEY,
      quantity: 10,
    };
    await inventoryApi.createTransfer(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/inventory/transfer', payload);
  });
});

// ─── inventoryApi.getTransfers ────────────────────

describe('inventoryApi.getTransfers', () => {
  it('calls GET /api/inventory/transfers with no params', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
    await inventoryApi.getTransfers();
    expect(mockGet).toHaveBeenCalledWith('/api/inventory/transfers?');
  });

  it('appends status filter', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 1 });
    await inventoryApi.getTransfers({ status: 'pending' });
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('status=pending'));
  });
});

// ─── inventoryApi.reserveStock ────────────────────

describe('inventoryApi.reserveStock', () => {
  it('calls POST /api/inventory/reserve', async () => {
    mockPost.mockResolvedValue({ id: 'res-1', status: 'active' });
    const payload = {
      product_id: 'prod-1',
      quantity: 5,
      order_id: 'order-1',
      location: StoreLocation.BRISBANE,
    };
    await inventoryApi.reserveStock(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/inventory/reserve', payload);
  });
});

// ─── inventoryApi.releaseReservation ──────────────

describe('inventoryApi.releaseReservation', () => {
  it('calls POST /api/inventory/release/:id', async () => {
    mockPost.mockResolvedValue(undefined);
    await inventoryApi.releaseReservation('res-1');
    expect(mockPost).toHaveBeenCalledWith('/api/inventory/release/res-1', {});
  });
});

// ─── inventoryApi.adjustStock ─────────────────────

describe('inventoryApi.adjustStock', () => {
  it('calls POST /api/inventory/adjust', async () => {
    mockPost.mockResolvedValue(undefined);
    const payload = {
      product_id: 'prod-1',
      quantity_change: -5,
      reason: 'damaged',
      location: StoreLocation.BRISBANE,
      adjustment_type: AdjustmentType.DAMAGE,
    };
    await inventoryApi.adjustStock(payload);
    expect(mockPost).toHaveBeenCalledWith('/api/inventory/adjust', payload);
  });
});
