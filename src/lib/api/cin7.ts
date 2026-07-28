/**
 * Cin7 API Client
 *
 * Type-safe client for Cin7 integration endpoints.
 * Handles connection management, sync operations, and real-time status.
 */

import { apiClient } from './client';

/**
 * Cin7 connection status response
 */
export interface Cin7ConnectorAllowlistEntry {
  name: string;
  ip: string;
}

export interface Cin7ConnectionStatus {
  connected: boolean;
  mode: 'demo' | 'live' | 'not_configured';
  core_connected: boolean;
  omni_connected: boolean;
  last_sync?: string;
  message?: string;
  connector_allowlist?: Cin7ConnectorAllowlistEntry[];
  /** True when status included a live Cin7 ping (`verify=true`). */
  verified?: boolean;
}

/**
 * Credentials for configuring the Cin7 integration
 */
export interface Cin7ConfigureRequest {
  core_account_id?: string;
  core_application_key?: string;
  omni_username?: string;
  omni_api_key?: string;
}

/**
 * Cin7 sync log entry
 */
export interface Cin7SyncLog {
  id: string;
  entity_type: string;
  direction: string;
  status: string;
  records_processed: number;
  synced_at: string;
  error_message?: string;
}

/**
 * Cin7 SSE stream stats
 */
export interface Cin7StreamStats {
  channel: string;
  active_connections: number;
  total_events_sent: number;
  checked_at: string;
}

/**
 * Cin7 polling status
 */
export interface Cin7PollStatus {
  polling_enabled: boolean;
  intervals: {
    products: number;
    customers: number;
    sales: number;
    inventory: number;
  };
  sync_enabled: {
    products: boolean;
    customers: boolean;
    sales: boolean;
    inventory: boolean;
  };
  mode: string;
  checked_at: string;
}

/**
 * Cin7 sync health score
 */
export interface Cin7SyncHealth {
  score: number;
  grade: string;
  details: {
    success_rate: number;
    success_score: number;
    duration_score: number;
    volume_score: number;
    total_syncs: number;
    avg_duration_ms: number;
  };
}

/**
 * Get Cin7 connection status.
 * Default is fast (credentials + disconnect cookie only). Pass `{ verify: true }` to live-ping Cin7.
 * Concurrent identical fast requests are deduped; short TTL cache avoids remount storms.
 */
let cin7StatusInFlight: Promise<Cin7ConnectionStatus> | null = null;
let cin7StatusCache: { at: number; value: Cin7ConnectionStatus } | null = null;
const CIN7_STATUS_TTL_MS = 4_000;

export async function getCin7Status(options?: { verify?: boolean }): Promise<Cin7ConnectionStatus> {
  const verify = options?.verify ?? false;
  const qs = verify ? '?verify=true' : '';
  const timeoutMs = verify ? 60_000 : 15_000;

  if (!verify) {
    if (cin7StatusCache && Date.now() - cin7StatusCache.at < CIN7_STATUS_TTL_MS) {
      return cin7StatusCache.value;
    }
    if (cin7StatusInFlight) return cin7StatusInFlight;
  }

  const request = apiClient
    .get<Cin7ConnectionStatus>(`/api/integrations/cin7/status${qs}`, undefined, timeoutMs)
    .then((status) => {
      if (!verify) {
        cin7StatusCache = { at: Date.now(), value: status };
      } else {
        // Live verify updates the cache so UI stays consistent.
        cin7StatusCache = { at: Date.now(), value: status };
      }
      return status;
    })
    .finally(() => {
      if (!verify) cin7StatusInFlight = null;
    });

  if (!verify) cin7StatusInFlight = request;
  return request;
}

/** Clear client status cache after connect/disconnect/configure. */
export function invalidateCin7StatusCache(): void {
  cin7StatusCache = null;
  cin7StatusInFlight = null;
}

/**
 * Save Cin7 credentials to the database (creates or updates the connection record)
 */
export async function configureCin7(data: Cin7ConfigureRequest): Promise<Cin7ConnectionStatus> {
  invalidateCin7StatusCache();
  return apiClient.post<Cin7ConnectionStatus>('/api/integrations/cin7/configure', data);
}

/**
 * Connect to Cin7 (demo or live mode)
 */
export async function connectCin7(): Promise<Cin7ConnectionStatus> {
  invalidateCin7StatusCache();
  return apiClient.post<Cin7ConnectionStatus>('/api/integrations/cin7/connect');
}

/**
 * Disconnect from Cin7
 */
export async function disconnectCin7(): Promise<{ status: string }> {
  invalidateCin7StatusCache();
  return apiClient.post<{ status: string }>('/api/integrations/cin7/disconnect');
}

/**
 * Trigger manual sync for a specific entity type
 */
export async function triggerCin7Sync(
  entityType:
    | 'products'
    | 'customers'
    | 'internal-customers'
    | 'suppliers'
    | 'branches'
    | 'warehouses'
    | 'product-categories'
    | 'brands'
    | 'price-lists'
    | 'tax-codes'
    | 'units-of-measure'
    | 'stock-levels'
    | 'orders'
    | 'inventory'
): Promise<{
  status: string;
  records_processed?: number;
  duration_ms?: number;
  page_size?: number;
  cin7_source_styles?: number;
  skipped?: Record<string, number>;
  complete?: boolean;
  sync_errors?: string[];
}> {
  return apiClient.post(`/api/integrations/cin7/sync/${entityType}`, undefined, undefined, 300_000);
}

export type {
  Cin7ExceptionEntity,
  Cin7ExceptionRecord,
  Cin7ReconciliationSnapshot,
} from '@/lib/integrations/cin7-reconciliation';

export type Cin7ReconciliationResponse =
  import('@/lib/integrations/cin7-reconciliation').Cin7ReconciliationSnapshot & {
    cache_meta?: {
      from_cache: boolean;
      cached_at: string | null;
      ttl_ms: number;
      force_requested?: boolean;
    };
  };

/**
 * Compare Cin7 live counts with Optix imported master data.
 * Uses a server-side cache by default; pass force=true to pull fresh data from Cin7.
 */
export async function getCin7Reconciliation(options?: {
  force?: boolean;
}): Promise<Cin7ReconciliationResponse> {
  const params = new URLSearchParams();
  if (options?.force) params.set('force', 'true');
  const qs = params.toString();
  return apiClient.get(
    `/api/integrations/cin7/reconciliation${qs ? `?${qs}` : ''}`,
    undefined,
    300_000
  );
}

export async function getCin7ExceptionReport(
  entity: import('@/lib/integrations/cin7-reconciliation').Cin7ExceptionEntity,
  limit = 100,
  offset = 0
): Promise<{
  entity: string;
  total: number;
  offset: number;
  limit: number;
  items: import('@/lib/integrations/cin7-reconciliation').Cin7ExceptionRecord[];
}> {
  return apiClient.get(
    `/api/integrations/cin7/reconciliation/exceptions?entity=${entity}&limit=${limit}&offset=${offset}`,
    undefined,
    300_000
  );
}

export function getCin7ExceptionReportExportUrl(
  entity: import('@/lib/integrations/cin7-reconciliation').Cin7ExceptionEntity,
  offset = 0,
  limit = 2000
): string {
  const params = new URLSearchParams({
    entity,
    offset: String(offset),
    limit: String(limit),
    format: 'csv',
  });
  return `/api/integrations/cin7/reconciliation/exceptions?${params.toString()}`;
}

export async function cleanupCin7DuplicateCustomers(): Promise<{
  status: string;
  email_duplicates_removed: number;
  orphan_no_id_removed: number;
  kept: number;
}> {
  return apiClient.post('/api/integrations/cin7/cleanup-duplicates');
}

/**
 * Get recent sync logs
 */
export async function getCin7SyncLogs(limit: number = 20): Promise<{ logs: Cin7SyncLog[] }> {
  // Must use /sync-history — /sync/logs is gitignored and also collides with POST /sync/[entityType] (405).
  return apiClient.get(`/api/integrations/cin7/sync-history?limit=${limit}`);
}

/**
 * Get SSE stream stats
 */
export async function getCin7StreamStats(): Promise<Cin7StreamStats> {
  return apiClient.get<Cin7StreamStats>('/api/integrations/cin7/stream/stats');
}

/**
 * Get polling status and configuration
 */
export async function getCin7PollStatus(): Promise<Cin7PollStatus> {
  return apiClient.get<Cin7PollStatus>('/api/integrations/cin7/poll/status');
}

/**
 * Trigger manual poll
 */
export async function triggerCin7Poll(
  source: 'core' | 'omni' = 'core'
): Promise<{ total_changes: number; duration_ms: number }> {
  return apiClient.post(`/api/integrations/cin7/poll?source=${source}`);
}

/**
 * Get AI-powered sync health score
 */
export async function getCin7SyncHealth(): Promise<Cin7SyncHealth> {
  return apiClient.get<Cin7SyncHealth>('/api/ai/cin7-anomaly/sync-health');
}

/**
 * Cin7 line item (order or purchase order)
 */
export interface Cin7LineItem {
  id: string;
  cin7_line_id: string | null;
  product_sku: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_rate: number | null;
  notes: string | null;
  created_at: string;
}

/**
 * Response for line items listing
 */
export interface Cin7LineItemsResponse {
  mapping_id: string;
  cin7_order_number?: string;
  cin7_po_number?: string;
  line_items: Cin7LineItem[];
  total_items: number;
}

/**
 * Get line items for a Cin7 order mapping
 */
export async function getOrderLineItems(mappingId: string): Promise<Cin7LineItemsResponse> {
  return apiClient.get<Cin7LineItemsResponse>(`/api/cin7/orders/${mappingId}/line-items`);
}

/**
 * Get line items for a Cin7 purchase order mapping
 */
export async function getPurchaseOrderLineItems(mappingId: string): Promise<Cin7LineItemsResponse> {
  return apiClient.get<Cin7LineItemsResponse>(`/api/cin7/purchase-orders/${mappingId}/line-items`);
}
