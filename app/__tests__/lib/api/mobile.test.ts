import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock global fetch for public endpoints
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { mobileApi, getGuestOrder, approveGuestOrder, uploadProductPhoto } from '@/lib/api/mobile';
import { apiClient } from '@/lib/api/client';

const mockPost = vi.mocked(apiClient.post);
const mockGet = vi.mocked(apiClient.get);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
});

describe('mobileApi.createGuestOrder', () => {
  it('calls POST /api/mobile/guest-orders with order data', async () => {
    const orderData = {
      customer_email: 'test@example.com',
      customer_name: 'Test User',
      items: [{ product_name: 'Truckmount Filter', quantity: 2, unit_price: 49.95 }],
    };
    const response = {
      token: 'tok-abc123',
      status: 'pending',
      customer_email: 'test@example.com',
      customer_name: 'Test User',
      items: orderData.items,
      total: 99.9,
      created_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
      approval_url: '/guest/order/tok-abc123',
    };
    mockPost.mockResolvedValue(response);
    const result = await mobileApi.createGuestOrder(orderData as any);
    expect(mockPost).toHaveBeenCalledWith('/api/mobile/guest-orders', orderData);
    expect(result).toEqual(response);
  });
});

describe('mobileApi.listCustomerLinks', () => {
  it('calls GET /api/mobile/customer-links', async () => {
    mockGet.mockResolvedValue([]);
    await mobileApi.listCustomerLinks();
    expect(mockGet).toHaveBeenCalledWith('/api/mobile/customer-links');
  });

  it('returns the customer links array', async () => {
    const links = [{ id: 'link-1', customer_name: 'CCW Client', status: 'active' }];
    mockGet.mockResolvedValue(links);
    const result = await mobileApi.listCustomerLinks();
    expect(result).toEqual(links);
  });
});

describe('getGuestOrder', () => {
  it('calls the guest order endpoint with the token', async () => {
    const mockOrder = {
      token: 'tok-xyz',
      status: 'pending',
      customer_name: 'Jane',
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      delivery_address: null,
      notes: null,
      tradesperson_name: 'Bob',
      expires_at: '2026-01-02T00:00:00Z',
      is_expired: false,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockOrder),
    });

    const result = await getGuestOrder('tok-xyz');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/guest/order/tok-xyz'),
      expect.any(Object),
    );
    expect(result).toEqual(mockOrder);
  });

  it('throws Error with "Order not found" on 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    await expect(getGuestOrder('bad-token')).rejects.toThrow('Order not found');
  });

  it('throws Error on other failures', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(getGuestOrder('tok-xyz')).rejects.toThrow('Failed to load order');
  });
});

describe('approveGuestOrder', () => {
  it('calls the approve endpoint with the token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: 'approved' }),
    });
    await approveGuestOrder('tok-xyz');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/guest/order/tok-xyz/approve'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('uploadProductPhoto', () => {
  it('posts form data to photo-upload endpoint', async () => {
    const mockFile = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    const mockResponse = {
      image_id: 'img-001',
      status: 'processed',
      matches: [],
      low_confidence_warning: false,
      context_description: null,
      processing_time_ms: 250,
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await uploadProductPhoto(mockFile);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/mobile/photo-upload'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws on upload failure', async () => {
    const mockFile = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'File too large' }),
    });
    await expect(uploadProductPhoto(mockFile)).rejects.toThrow('File too large');
  });
});
