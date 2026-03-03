/**
 * Google Agent Payments Protocol (AP2) — TypeScript API client.
 *
 * Wraps all AP2 backend endpoints:
 * - Mandate chain (Intent → Cart → Payment)
 * - Payment execution and status
 * - Voice commerce sessions
 */

import { apiClient } from '@/lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AP2MandateResponse {
  mandate_id: string;
  mandate_type: 'intent' | 'cart' | 'payment';
  status: 'pending' | 'verified' | 'executed' | 'expired' | 'failed';
  expires_at: string;
  signature: string | null;
  parent_mandate_id: string | null;
}

export interface AP2TransactionResponse {
  transaction_id: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  completed_at: string | null;
}

export interface AP2VoiceSessionResponse {
  session_id: string;
  status: 'active' | 'completed' | 'abandoned';
  language: string;
  started_at: string;
}

export interface AP2CartItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

// ─── Mandate Chain ─────────────────────────────────────────────────────────────

export async function createIntentMandate(
  intentDescription: string,
  language = 'en',
  metadata?: Record<string, unknown>
): Promise<AP2MandateResponse> {
  return apiClient.post<AP2MandateResponse>('/api/integrations/ap2/mandates/intent', {
    intent_description: intentDescription,
    language,
    metadata,
  });
}

export async function createCartMandate(
  parentMandateId: string,
  cartItems: AP2CartItem[],
  totalAmount: number,
  currency = 'AUD'
): Promise<AP2MandateResponse> {
  return apiClient.post<AP2MandateResponse>('/api/integrations/ap2/mandates/cart', {
    parent_mandate_id: parentMandateId,
    cart_items: cartItems,
    total_amount: totalAmount,
    currency,
  });
}

export async function createPaymentMandate(
  parentMandateId: string,
  paymentAmount: number,
  paymentMethod: string,
  currency = 'AUD'
): Promise<AP2MandateResponse> {
  return apiClient.post<AP2MandateResponse>('/api/integrations/ap2/mandates/payment', {
    parent_mandate_id: parentMandateId,
    payment_amount: paymentAmount,
    payment_method: paymentMethod,
    currency,
  });
}

export async function verifyMandate(
  mandateId: string,
  signature: string,
  publicKey: string
): Promise<{ mandate_id: string; verified: boolean; verified_at: string | null }> {
  return apiClient.post(`/api/integrations/ap2/mandates/${mandateId}/verify`, {
    signature,
    public_key: publicKey,
  });
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function executePayment(
  mandateId: string,
  orderId?: string
): Promise<AP2TransactionResponse> {
  return apiClient.post<AP2TransactionResponse>(
    `/api/integrations/ap2/payments/execute?mandate_id=${mandateId}`,
    { order_id: orderId ?? null }
  );
}

export async function getPaymentStatus(transactionId: string): Promise<AP2TransactionResponse> {
  return apiClient.get<AP2TransactionResponse>(`/api/integrations/ap2/payments/${transactionId}`);
}

// ─── Voice Commerce ────────────────────────────────────────────────────────────

export async function createVoiceSession(language = 'en'): Promise<AP2VoiceSessionResponse> {
  return apiClient.post<AP2VoiceSessionResponse>(
    `/api/integrations/ap2/voice/sessions?language=${language}`,
    {}
  );
}

export async function processVoiceInput(
  sessionId: string,
  voiceText: string,
  language = 'en'
): Promise<{ intent: string; confidence: number; response: string }> {
  return apiClient.post(`/api/integrations/ap2/voice/sessions/${sessionId}/input`, {
    voice_text: voiceText,
    language,
  });
}
