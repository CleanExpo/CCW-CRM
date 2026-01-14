/**
 * Shopify API Client
 *
 * Type-safe client for Shopify integration endpoints.
 * Handles order imports and inventory sync operations.
 */

import { apiClient, ApiClientError } from "./client";

/**
 * Shopify connection status response
 */
export interface ShopifyConnectionStatus {
  connected: boolean;
  mode: "demo" | "live";
  shop_domain?: string;
  shop_name?: string;
  last_order_sync?: string;
  last_inventory_sync?: string;
  message?: string;
}

/**
 * Order import result
 */
export interface ShopifyOrderImportResult {
  success: boolean;
  mode?: "demo" | "live";
  order_id: string;
  order_number: string;
  customer_id: string;
  total: number;
  status: string;
  shopify_order_id: number;
}

/**
 * Bulk order import result
 */
export interface ShopifyBulkImportResult {
  success: boolean;
  mode?: "demo" | "live";
  imported_count: number;
  orders: Array<{
    id: string;
    order_number: string;
    total: number;
    status: string;
  }>;
}

/**
 * Inventory sync result
 */
export interface ShopifyInventorySyncResult {
  success: boolean;
  mode?: "demo" | "live";
  product_id: string;
  sku: string;
  stock: number;
  shopify_product_id?: number;
  synced_at?: string;
  error?: string;
}

/**
 * Bulk inventory sync result
 */
export interface ShopifyBulkInventorySyncResult {
  success: boolean;
  mode?: "demo" | "live";
  total: number;
  synced: number;
  failed: number;
  results: ShopifyInventorySyncResult[];
}

/**
 * Product sync result
 */
export interface ShopifyProductSyncResult {
  success: boolean;
  mode?: "demo" | "live";
  product_id: string;
  sku: string;
  shopify_product_id?: number;
  shopify_variant_id?: number;
  error?: string;
}

/**
 * Connect response
 */
export interface ShopifyConnectResponse {
  success: boolean;
  mode: "demo" | "live";
  shop_domain: string;
  shop_name?: string;
  message?: string;
}

/**
 * Get Shopify connection status
 */
export async function getShopifyStatus(): Promise<ShopifyConnectionStatus> {
  return apiClient.get<ShopifyConnectionStatus>(
    "/api/integrations/shopify/status"
  );
}

/**
 * Connect to Shopify store
 */
export async function connectShopify(): Promise<ShopifyConnectResponse> {
  return apiClient.post<ShopifyConnectResponse>(
    "/api/integrations/shopify/connect"
  );
}

/**
 * Disconnect from Shopify store
 */
export async function disconnectShopify(): Promise<{ success: boolean; message: string }> {
  return apiClient.post<{ success: boolean; message: string }>(
    "/api/integrations/shopify/disconnect"
  );
}

/**
 * Import a single order from Shopify
 *
 * @param orderId - Shopify order ID to import
 */
export async function importShopifyOrder(
  orderId: string
): Promise<ShopifyOrderImportResult> {
  return apiClient.post<ShopifyOrderImportResult>(
    `/api/integrations/shopify/import-order/${orderId}`
  );
}

/**
 * Import recent orders from Shopify
 *
 * @param maxOrders - Maximum number of orders to import (default: 50)
 * @param createdAfter - ISO 8601 date to filter orders (optional)
 */
export async function importRecentShopifyOrders(
  maxOrders: number = 50,
  createdAfter?: string
): Promise<ShopifyBulkImportResult> {
  const params = new URLSearchParams({
    max_orders: maxOrders.toString(),
  });

  if (createdAfter) {
    params.append("created_after", createdAfter);
  }

  return apiClient.post<ShopifyBulkImportResult>(
    `/api/integrations/shopify/import-orders?${params.toString()}`
  );
}

/**
 * Sync a single product's inventory to Shopify
 *
 * @param productId - ERP product ID (UUID string)
 */
export async function syncProductInventory(
  productId: string
): Promise<ShopifyInventorySyncResult> {
  return apiClient.post<ShopifyInventorySyncResult>(
    `/api/integrations/shopify/sync-inventory/${productId}`
  );
}

/**
 * Sync all mapped products' inventory to Shopify
 */
export async function syncAllInventory(): Promise<ShopifyBulkInventorySyncResult> {
  return apiClient.post<ShopifyBulkInventorySyncResult>(
    "/api/integrations/shopify/sync-all-inventory"
  );
}

/**
 * Sync product details (name, price, etc.) to Shopify
 *
 * @param productId - ERP product ID (UUID string)
 */
export async function syncProductToShopify(
  productId: string
): Promise<ShopifyProductSyncResult> {
  return apiClient.post<ShopifyProductSyncResult>(
    `/api/integrations/shopify/sync-product/${productId}`
  );
}

/**
 * Check if Shopify is connected
 */
export async function isShopifyConnected(): Promise<boolean> {
  try {
    const status = await getShopifyStatus();
    return status.connected;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return false;
    }
    throw error;
  }
}
