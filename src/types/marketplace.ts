/**
 * Marketplace Integration TypeScript Types
 * DTO shapes for marketplace API responses.
 */

export enum ChannelType {
  SHOPIFY = 'shopify',
  EBAY = 'ebay',
  FACEBOOK = 'facebook',
}

export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  PENDING = 'pending',
}

export enum ListingStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  INACTIVE = 'inactive',
  ERROR = 'error',
  PENDING = 'pending',
}

export enum SyncStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  IN_PROGRESS = 'in_progress',
  PENDING = 'pending',
  PARTIAL = 'partial',
}

export enum MarketplaceOrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export interface MarketplaceConnection {
  id: string;
  channel_type: ChannelType;
  display_name: string;
  status: ConnectionStatus;
  is_active: boolean;
  mode: 'demo' | 'live';
  credentials?: Record<string, any>;
  channel_metadata?: Record<string, any>;
  sync_settings?: Record<string, any>;
  last_product_sync?: string;
  last_inventory_sync?: string;
  last_order_sync?: string;
  last_sync_error?: string;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceProductListing {
  id: string;
  product_id: string;
  channel_type: ChannelType;
  connection_id: string;
  external_product_id?: string;
  external_variant_id?: string;
  external_url?: string;
  listed_title?: string;
  listed_price?: number;
  listed_currency: string;
  listed_quantity: number;
  status: ListingStatus;
  channel_data?: Record<string, any>;
  last_synced_at?: string;
  sync_status: string;
  sync_error?: string;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOrder {
  id: string;
  channel_type: ChannelType;
  connection_id: string;
  external_order_id: string;
  external_order_number?: string;
  erp_order_id?: string;
  status: MarketplaceOrderStatus;
  customer_name?: string;
  customer_email?: string;
  total_amount?: number;
  currency: string;
  shipping_address?: Record<string, any>;
  line_items?: Record<string, any>;
  synced_at?: string;
  sync_status: string;
  sync_error?: string;
  channel_data?: Record<string, any>;
  ordered_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceInventorySync {
  id: string;
  product_id: string;
  channel_type: ChannelType;
  connection_id: string;
  local_quantity: number;
  remote_quantity: number;
  quantity_delta: number;
  sync_status: SyncStatus;
  sync_direction: 'push' | 'pull';
  sync_error?: string;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceSyncLog {
  id: string;
  channel_type: ChannelType;
  connection_id?: string;
  operation: string;
  entity_type?: string;
  entity_id?: string;
  status: SyncStatus;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  error_message?: string;
  details?: Record<string, any>;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}
