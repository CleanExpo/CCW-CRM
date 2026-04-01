import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import {
  createIntentMandate,
  createCartMandate,
  createPaymentMandate,
  verifyMandate,
  executePayment,
  getPaymentStatus,
  listMandates,
  listTransactions,
  createVoiceSession,
  processVoiceInput,
} from '@/lib/api/ap2';
import { apiClient } from '@/lib/api/client';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createIntentMandate', () => {
  it('calls POST /api/integrations/ap2/mandates/intent', async () => {
    mockPost.mockResolvedValue({ mandate_id: 'm-1', mandate_type: 'intent' });
    await createIntentMandate('Buy cleaning supplies');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/ap2/mandates/intent', {
      intent_description: 'Buy cleaning supplies',
      language: 'en',
      metadata: undefined,
    });
  });
});

describe('createCartMandate', () => {
  it('calls POST with cart items and total', async () => {
    mockPost.mockResolvedValue({ mandate_id: 'm-2' });
    const items = [{ product_id: 'p-1', name: 'Truckmount', quantity: 1, unit_price: 5000 }];
    await createCartMandate('m-1', items, 5000);
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/ap2/mandates/cart', {
      parent_mandate_id: 'm-1',
      cart_items: items,
      total_amount: 5000,
      currency: 'AUD',
    });
  });
});

describe('createPaymentMandate', () => {
  it('calls POST with payment details', async () => {
    mockPost.mockResolvedValue({ mandate_id: 'm-3' });
    await createPaymentMandate('m-2', 5000, 'credit_card');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/ap2/mandates/payment', {
      parent_mandate_id: 'm-2',
      payment_amount: 5000,
      payment_method: 'credit_card',
      currency: 'AUD',
    });
  });
});

describe('verifyMandate', () => {
  it('calls POST /api/integrations/ap2/mandates/:id/verify', async () => {
    mockPost.mockResolvedValue({ mandate_id: 'm-1', verified: true });
    await verifyMandate('m-1', 'sig-abc', 'pk-xyz');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/ap2/mandates/m-1/verify', {
      signature: 'sig-abc',
      public_key: 'pk-xyz',
    });
  });
});

describe('executePayment', () => {
  it('calls POST /api/integrations/ap2/payments/execute', async () => {
    mockPost.mockResolvedValue({ transaction_id: 'txn-1', status: 'completed' });
    await executePayment('m-3', 'order-1');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/ap2/payments/execute?mandate_id=m-3', {
      order_id: 'order-1',
    });
  });
});

describe('getPaymentStatus', () => {
  it('calls GET /api/integrations/ap2/payments/:id', async () => {
    mockGet.mockResolvedValue({ transaction_id: 'txn-1', status: 'completed' });
    await getPaymentStatus('txn-1');
    expect(mockGet).toHaveBeenCalledWith('/api/integrations/ap2/payments/txn-1');
  });
});

describe('listMandates', () => {
  it('calls GET with default pagination', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
    await listMandates();
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('page=1');
    expect(url).toContain('page_size=20');
  });

  it('appends mandate_type filter', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0 });
    await listMandates(1, 20, 'intent');
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('mandate_type=intent'));
  });
});

describe('listTransactions', () => {
  it('calls GET /api/integrations/ap2/transactions', async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
    await listTransactions();
    const url = mockGet.mock.calls[0][0];
    expect(url).toContain('/api/integrations/ap2/transactions');
  });
});

describe('createVoiceSession', () => {
  it('calls POST with default language', async () => {
    mockPost.mockResolvedValue({ session_id: 'vs-1', status: 'active' });
    await createVoiceSession();
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/ap2/voice/sessions?language=en', {});
  });
});

describe('processVoiceInput', () => {
  it('calls POST /api/integrations/ap2/voice/sessions/:id/input', async () => {
    mockPost.mockResolvedValue({ intent: 'buy', confidence: 0.95, response: 'OK' });
    await processVoiceInput('vs-1', 'I want to buy a truckmount');
    expect(mockPost).toHaveBeenCalledWith('/api/integrations/ap2/voice/sessions/vs-1/input', {
      voice_text: 'I want to buy a truckmount',
      language: 'en',
    });
  });
});
