/**
 * Mobile Photo-to-Order API client
 *
 * Tradesperson-facing (authenticated) and customer-facing (token-based) endpoints.
 */
import { apiClient } from './client';
import { getAppOrigin } from '@/lib/api/backend-url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductMatch {
  product_id: string | null;
  sku: string | null;
  product_name: string;
  category: string | null;
  confidence: number;
  suggested_quantity: number;
  reasoning: string | null;
  matched_to_catalog: boolean;
}

export interface PhotoUploadResponse {
  image_id: string;
  status: string;
  matches: ProductMatch[];
  low_confidence_warning: boolean;
  context_description: string | null;
  processing_time_ms: number;
}

export interface OrderItem {
  product_id?: string;
  product_name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
}

export interface CreateGuestOrderRequest {
  image_id?: string;
  customer_email: string;
  customer_name: string;
  customer_id?: string;
  items: OrderItem[];
  delivery_address?: Record<string, string>;
  notes?: string;
  expires_hours?: number;
}

export interface GuestOrderSummaryResponse {
  token: string;
  status: string;
  customer_email: string;
  customer_name: string;
  items: OrderItem[];
  total: number;
  created_at: string;
  expires_at: string;
  approval_url: string;
}

export interface CustomerOrderResponse {
  token: string;
  status: string;
  customer_name: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  delivery_address: Record<string, string> | null;
  notes: string | null;
  tradesperson_name: string;
  expires_at: string;
  is_expired: boolean;
}

export interface CustomerLink {
  id: string;
  customer_name: string;
  customer_email: string;
  status: string;
  auto_approve_under: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Tradesperson endpoints (authenticated)
// ---------------------------------------------------------------------------

export async function uploadProductPhoto(
  file: File,
  contextNotes?: string
): Promise<PhotoUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (contextNotes) {
    formData.append('context_notes', contextNotes);
  }

  const response = await fetch(
    `${getAppOrigin()}/api/mobile/photo-upload`,
    {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type — browser sets multipart boundary automatically
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail ?? 'Photo upload failed');
  }

  return response.json();
}

export const mobileApi = {
  createGuestOrder: (data: CreateGuestOrderRequest) =>
    apiClient.post<GuestOrderSummaryResponse>('/api/mobile/guest-orders', data),

  listCustomerLinks: () => apiClient.get<CustomerLink[]>('/api/mobile/customer-links'),
};

// ---------------------------------------------------------------------------
// Guest (public) endpoints — no auth required
// ---------------------------------------------------------------------------

export async function getGuestOrder(token: string): Promise<CustomerOrderResponse> {
  const res = await fetch(`${getAppOrigin()}/api/guest/order/${token}`, { cache: 'no-store' });
  if (res.status === 404) throw new Error('Order not found');
  if (!res.ok) throw new Error('Failed to load order');
  return res.json();
}

export async function approveGuestOrder(
  token: string,
  notes?: string
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${getAppOrigin()}/api/guest/order/${token}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (res.status === 410) throw new Error('This order link has expired');
  if (res.status === 409) {
    const body = await res.json();
    throw new Error(body.detail ?? 'Order cannot be approved at this stage');
  }
  if (!res.ok) throw new Error('Approval failed');
  return res.json();
}

export async function declineGuestOrder(
  token: string,
  reason: string
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${getAppOrigin()}/api/guest/order/${token}/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? 'Decline failed');
  }
  return res.json();
}
