/**
 * Billing API Client Tests
 *
 * Tests the type-safe billing API client for subscription management,
 * payment methods, and invoices.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { billingApi } from '@/lib/api/billing';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

beforeEach(() => vi.clearAllMocks());

// ─── Subscription ───────────────────────────────────────────────────

describe('billingApi.getSubscription', () => {
  it('calls GET /api/billing/subscription', async () => {
    const mockSub = { id: 'sub-1', tier: 'professional', status: 'active' };
    mockGet.mockResolvedValue(mockSub);
    const result = await billingApi.getSubscription();
    expect(mockGet).toHaveBeenCalledWith('/api/billing/subscription');
    expect(result.id).toBe('sub-1');
  });
});

describe('billingApi.subscribe', () => {
  it('posts subscription data to /api/billing/subscribe', async () => {
    const data = {
      tier: 'professional' as const,
      billing_interval: 'monthly' as const,
      payment_method_id: 'pm-1',
    };
    mockPost.mockResolvedValue({ id: 'sub-new', ...data, status: 'active' });
    await billingApi.subscribe(data);
    expect(mockPost).toHaveBeenCalledWith('/api/billing/subscribe', data);
  });
});

describe('billingApi.updateSubscription', () => {
  it('puts update to /api/billing/subscription', async () => {
    const data = { tier: 'enterprise' as const };
    mockPut.mockResolvedValue({ id: 'sub-1', tier: 'enterprise' });
    await billingApi.updateSubscription(data);
    expect(mockPut).toHaveBeenCalledWith('/api/billing/subscription', data);
  });

  it('can update billing interval', async () => {
    const data = { billing_interval: 'annual' as const };
    mockPut.mockResolvedValue({ id: 'sub-1', billing_interval: 'annual' });
    await billingApi.updateSubscription(data);
    expect(mockPut).toHaveBeenCalledWith('/api/billing/subscription', data);
  });
});

describe('billingApi.cancelSubscription', () => {
  it('deletes /api/billing/subscription with immediately=false by default', async () => {
    mockDelete.mockResolvedValue(undefined);
    await billingApi.cancelSubscription();
    expect(mockDelete).toHaveBeenCalledWith('/api/billing/subscription?immediately=false');
  });

  it('passes immediately=true when requested', async () => {
    mockDelete.mockResolvedValue(undefined);
    await billingApi.cancelSubscription(true);
    expect(mockDelete).toHaveBeenCalledWith('/api/billing/subscription?immediately=true');
  });
});

// ─── Payment Methods ────────────────────────────────────────────────

describe('billingApi.getPaymentMethods', () => {
  it('calls GET /api/billing/payment-methods', async () => {
    const mockMethods = [
      { id: 'pm-1', brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2027, is_default: true },
    ];
    mockGet.mockResolvedValue(mockMethods);
    const result = await billingApi.getPaymentMethods();
    expect(mockGet).toHaveBeenCalledWith('/api/billing/payment-methods');
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe('visa');
  });
});

describe('billingApi.addPaymentMethod', () => {
  it('posts payment method ID', async () => {
    mockPost.mockResolvedValue({ id: 'pm-new', brand: 'mastercard', last4: '5555' });
    await billingApi.addPaymentMethod('pm_stripe_abc');
    expect(mockPost).toHaveBeenCalledWith('/api/billing/payment-methods', {
      payment_method_id: 'pm_stripe_abc',
    });
  });
});

describe('billingApi.removePaymentMethod', () => {
  it('deletes /api/billing/payment-methods/:id', async () => {
    mockDelete.mockResolvedValue(undefined);
    await billingApi.removePaymentMethod('pm-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/billing/payment-methods/pm-1');
  });
});

// ─── Invoices ───────────────────────────────────────────────────────

describe('billingApi.getInvoices', () => {
  it('calls GET /api/billing/invoices with default limit', async () => {
    mockGet.mockResolvedValue([]);
    await billingApi.getInvoices();
    expect(mockGet).toHaveBeenCalledWith('/api/billing/invoices?limit=10');
  });

  it('passes custom limit', async () => {
    mockGet.mockResolvedValue([]);
    await billingApi.getInvoices(25);
    expect(mockGet).toHaveBeenCalledWith('/api/billing/invoices?limit=25');
  });

  it('returns invoice data', async () => {
    const mockInvoices = [
      { id: 'inv-1', amount_due: 9900, amount_paid: 9900, currency: 'aud', status: 'paid' },
    ];
    mockGet.mockResolvedValue(mockInvoices);
    const result = await billingApi.getInvoices();
    expect(result[0].amount_due).toBe(9900);
  });
});

describe('billingApi.listInvoices (deprecated)', () => {
  it('delegates to getInvoices', async () => {
    mockGet.mockResolvedValue([]);
    await billingApi.listInvoices(5);
    expect(mockGet).toHaveBeenCalledWith('/api/billing/invoices?limit=5');
  });
});

// ─── Error propagation ──────────────────────────────────────────────

describe('error handling', () => {
  it('propagates errors from getSubscription', async () => {
    mockGet.mockRejectedValue(new Error('Unauthorized'));
    await expect(billingApi.getSubscription()).rejects.toThrow('Unauthorized');
  });

  it('propagates errors from subscribe', async () => {
    mockPost.mockRejectedValue(new Error('Payment failed'));
    await expect(
      billingApi.subscribe({
        tier: 'starter',
        billing_interval: 'monthly',
        payment_method_id: 'pm-bad',
      })
    ).rejects.toThrow('Payment failed');
  });
});
