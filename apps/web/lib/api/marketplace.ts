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
};
