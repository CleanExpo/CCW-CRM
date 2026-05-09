/**
 * Xero Integration API Client
 *
 * Handles all API calls to Xero integration endpoints.
 */

import { apiClient } from './client';

// ============================================
// Types
// ============================================

export interface XeroConnectionStatus {
  connected: boolean;
  mode: 'demo' | 'live' | 'not_configured';
  tenant_name?: string;
  tenant_id?: string;
  message?: string;
}

export interface XeroAuthResponse {
  mode: 'demo' | 'live';
  message?: string;
  authorization_url: string;
  state: string;
  instructions?: string;
}

export interface XeroSyncResult {
  success: boolean;
  mode?: 'demo' | 'live';
  order_id: string;
  order_number: string;
  xero_invoice_id: string;
  xero_invoice_number: string;
  total: number;
  status: string;
}

export interface XeroBulkSyncResult {
  total: number;
  synced: number;
  failed: number;
  errors: string[] | null;
}

export interface XeroInvoiceDetails {
  invoice_id: string;
  invoice_number: string;
  status: string;
  total: number;
  amount_due: number;
  date: string;
  due_date: string;
}

// ============================================
// OAuth Flow
// ============================================

/**
 * Start Xero OAuth2 authorization flow
 * Returns authorization URL to redirect user to
 */
export async function startXeroAuth(): Promise<XeroAuthResponse> {
  return apiClient.get<XeroAuthResponse>('/api/integrations/xero/authorize');
}

/**
 * Get current Xero connection status
 */
export async function getXeroStatus(): Promise<XeroConnectionStatus> {
  return apiClient.get<XeroConnectionStatus>('/api/integrations/xero/status');
}

/**
 * Disconnect Xero integration
 */
export async function disconnectXero(): Promise<{ success: boolean; message: string }> {
  return apiClient.post<{ success: boolean; message: string }>('/api/integrations/xero/disconnect');
}

// ============================================
// Invoice Sync
// ============================================

/**
 * Sync a single order to Xero as an invoice
 * @param orderId - UUID of the order to sync
 */
export async function syncOrderToXero(orderId: string): Promise<XeroSyncResult> {
  return apiClient.post<XeroSyncResult>(`/api/integrations/xero/sync-order/${orderId}`);
}

/**
 * Bulk sync multiple unsynced orders to Xero
 * @param maxOrders - Maximum number of orders to sync (default: 100)
 */
export async function bulkSyncOrders(maxOrders: number = 100): Promise<XeroBulkSyncResult> {
  return apiClient.post<XeroBulkSyncResult>(
    `/api/integrations/xero/sync-all?max_orders=${maxOrders}`
  );
}

/**
 * Get Xero invoice details for an order
 * @param orderId - UUID of the order
 */
export async function getXeroInvoice(orderId: string): Promise<XeroInvoiceDetails> {
  return apiClient.get<XeroInvoiceDetails>(`/api/integrations/xero/invoice/${orderId}`);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Check if Xero is connected
 */
export async function isXeroConnected(): Promise<boolean> {
  try {
    const status = await getXeroStatus();
    return status.connected;
  } catch {
    return false;
  }
}

/**
 * Get OAuth callback URL for this environment
 */
export function getXeroCallbackUrl(): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/dashboard/settings/integrations`;
}
