/**
 * Marketplace API Client
 *
 * Type-safe client for multi-channel marketplace integration endpoints.
 * Supports Shopify, eBay, and Facebook Marketplace channels.
 */

import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────

export interface SetupField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url';
  required: boolean;
  placeholder: string;
}

export interface ChannelInfo {
  channel_type: string;
  display_name: string;
  connected: boolean;
  mode: 'demo' | 'live';
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  last_product_sync: string | null;
  last_inventory_sync: string | null;
  last_order_sync: string | null;
  setup_fields: SetupField[];
}

export interface ChannelListResponse {
  channels: ChannelInfo[];
  total: number;
}

export interface ConnectResponse {
  success: boolean;
  channel_type: string;
  message: string;
  mode: 'demo' | 'live';
}

export interface ProductListing {
  external_id: string;
  title: string;
  sku: string | null;
  price: number;
  currency: string;
  quantity: number;
  status: string;
  category: string | null;
  url: string | null;
}

export interface SyncProductsResponse {
  success: boolean;
  results: Record<
    string,
    {
      pushed: number;
      failed: number;
      products: Array<{
        sku: string;
        external_id: string | null;
        success: boolean;
        error: string | null;
      }>;
    }
  >;
  synced_at: string;
}

export interface SyncStatusChannel {
  connected: boolean;
  channel_type: string;
  display_name: string;
  message: string;
  metadata: Record<string, unknown>;
  checked_at: string;
}

export interface SyncStatusResponse {
  channels: Record<string, SyncStatusChannel>;
  overall_healthy: boolean;
  checked_at: string;
}

export interface SyncInventoryResponse {
  success: boolean;
  results: Record<string, { synced: number; failed: number; errors: string[] }>;
  synced_at: string;
}

export interface MarketplaceOrder {
  external_id: string;
  external_order_number: string | null;
  channel_type: string;
  customer_name: string | null;
  customer_email: string | null;
  total_amount: number;
  currency: string;
  status: string;
  line_items: Array<Record<string, unknown>>;
  ordered_at: string | null;
}

export interface OrderFeedResponse {
  orders: MarketplaceOrder[];
  total: number;
  channels: string[];
}

export interface ChannelSetupFieldsResponse {
  channel_type: string;
  display_name: string;
  fields: SetupField[];
}

// ─── A5: Unified products + bulk operations types ────────────────────

export interface UnifiedProductChannelData {
  external_id: string;
  price: number;
  quantity: number;
  status: string;
  url: string | null;
}

export interface UnifiedProduct {
  sku: string | null;
  title: string;
  channels: Record<string, UnifiedProductChannelData>;
  has_discrepancy: boolean;
  min_stock: number;
  max_stock: number;
}

export interface UnifiedProductsResponse {
  products: UnifiedProduct[];
  total: number;
  channels: string[];
}

export interface BulkUnlistItem {
  external_id: string;
  channel_type: string;
}

export interface BulkUnlistResponse {
  results: Record<
    string,
    { success: boolean; error?: string; channel_type: string; external_id: string }
  >;
  success_count: number;
  failed_count: number;
}

// ─── API Functions ──────────────────────────────────────────────────

/** List all available marketplace channels with connection status */
export async function getMarketplaceChannels(): Promise<ChannelListResponse> {
  return apiClient.get<ChannelListResponse>('/api/marketplace/channels');
}

/** Connect to a marketplace channel */
export async function connectChannel(
  channelType: string,
  credentials: Record<string, string> = {}
): Promise<ConnectResponse> {
  return apiClient.post<ConnectResponse>(`/api/marketplace/channels/${channelType}/connect`, {
    credentials,
  });
}

/** Disconnect from a marketplace channel */
export async function disconnectChannel(channelType: string): Promise<ConnectResponse> {
  return apiClient.post<ConnectResponse>(`/api/marketplace/channels/${channelType}/disconnect`);
}

/** Get products listed on a specific channel */
export async function getChannelProducts(
  channelType: string,
  limit: number = 50,
  offset: number = 0
): Promise<ProductListing[]> {
  return apiClient.get<ProductListing[]>(
    `/api/marketplace/channels/${channelType}/products?limit=${limit}&offset=${offset}`
  );
}

/** Sync products to connected channels */
export async function syncProducts(channelTypes?: string[]): Promise<SyncProductsResponse> {
  return apiClient.post<SyncProductsResponse>('/api/marketplace/sync/products', {
    channel_types: channelTypes || null,
  });
}

/** Get sync status for all connected channels */
export async function getSyncStatus(): Promise<SyncStatusResponse> {
  return apiClient.get<SyncStatusResponse>('/api/marketplace/sync/status');
}

/** Push inventory levels to channels */
export async function syncInventory(
  items?: Array<{
    external_id: string;
    quantity: number;
    channel_type: string;
  }>,
  channelTypes?: string[]
): Promise<SyncInventoryResponse> {
  return apiClient.post<SyncInventoryResponse>('/api/marketplace/sync/inventory', {
    items: items || [],
    channel_types: channelTypes || null,
  });
}

/** Get unified order feed from all channels */
export async function getMarketplaceOrders(params?: {
  channel_type?: string;
  since?: string;
}): Promise<OrderFeedResponse> {
  const searchParams = new URLSearchParams();
  if (params?.channel_type) searchParams.set('channel_type', params.channel_type);
  if (params?.since) searchParams.set('since', params.since);
  const qs = searchParams.toString();
  return apiClient.get<OrderFeedResponse>(`/api/marketplace/orders${qs ? `?${qs}` : ''}`);
}

/** Get setup fields for a specific channel */
export async function getChannelSetupFields(
  channelType: string
): Promise<ChannelSetupFieldsResponse> {
  return apiClient.get<ChannelSetupFieldsResponse>(
    `/api/marketplace/channels/${channelType}/setup-fields`
  );
}

/** Get unified product view across all connected channels (A5) */
export async function getUnifiedProducts(limit: number = 50): Promise<UnifiedProductsResponse> {
  return apiClient.get<UnifiedProductsResponse>(`/api/marketplace/products?limit=${limit}`);
}

/** Bulk unlist products from specific channels (A5) */
export async function bulkUnlistProducts(items: BulkUnlistItem[]): Promise<BulkUnlistResponse> {
  return apiClient.post<BulkUnlistResponse>('/api/marketplace/bulk/unlist', { items });
}

/** Convenience: marketplace API namespace */
export const marketplaceApi = {
  getChannels: getMarketplaceChannels,
  connect: connectChannel,
  disconnect: disconnectChannel,
  getProducts: getChannelProducts,
  syncProducts,
  getSyncStatus,
  syncInventory,
  getOrders: getMarketplaceOrders,
  getSetupFields: getChannelSetupFields,
  getUnifiedProducts,
  bulkUnlistProducts,
};
