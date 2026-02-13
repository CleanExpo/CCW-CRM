/**
 * Cin7 API Client
 *
 * Type-safe client for Cin7 integration endpoints.
 * Handles connection management, sync operations, and real-time status.
 */

import { apiClient } from "./client";

/**
 * Cin7 connection status response
 */
export interface Cin7ConnectionStatus {
  connected: boolean;
  mode: "demo" | "live";
  core_connected: boolean;
  omni_connected: boolean;
  last_sync?: string;
  message?: string;
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
 * Get Cin7 connection status
 */
export async function getCin7Status(): Promise<Cin7ConnectionStatus> {
  return apiClient.get<Cin7ConnectionStatus>(
    "/api/integrations/cin7/status"
  );
}

/**
 * Connect to Cin7 (demo or live mode)
 */
export async function connectCin7(): Promise<Cin7ConnectionStatus> {
  return apiClient.post<Cin7ConnectionStatus>(
    "/api/integrations/cin7/connect"
  );
}

/**
 * Disconnect from Cin7
 */
export async function disconnectCin7(): Promise<{ status: string }> {
  return apiClient.post<{ status: string }>(
    "/api/integrations/cin7/disconnect"
  );
}

/**
 * Trigger manual sync for a specific entity type
 */
export async function triggerCin7Sync(
  entityType: "products" | "customers" | "orders" | "inventory"
): Promise<{ status: string; records_processed?: number }> {
  return apiClient.post(`/api/integrations/cin7/sync/${entityType}`);
}

/**
 * Get recent sync logs
 */
export async function getCin7SyncLogs(
  limit: number = 20
): Promise<{ logs: Cin7SyncLog[] }> {
  return apiClient.get(`/api/integrations/cin7/sync/logs?limit=${limit}`);
}

/**
 * Get SSE stream stats
 */
export async function getCin7StreamStats(): Promise<Cin7StreamStats> {
  return apiClient.get<Cin7StreamStats>(
    "/api/integrations/cin7/stream/stats"
  );
}

/**
 * Get polling status and configuration
 */
export async function getCin7PollStatus(): Promise<Cin7PollStatus> {
  return apiClient.get<Cin7PollStatus>(
    "/api/integrations/cin7/poll/status"
  );
}

/**
 * Trigger manual poll
 */
export async function triggerCin7Poll(
  source: "core" | "omni" = "core"
): Promise<{ total_changes: number; duration_ms: number }> {
  return apiClient.post(
    `/api/integrations/cin7/poll?source=${source}`
  );
}

/**
 * Get AI-powered sync health score
 */
export async function getCin7SyncHealth(): Promise<Cin7SyncHealth> {
  return apiClient.get<Cin7SyncHealth>(
    "/api/ai/cin7-anomaly/sync-health"
  );
}
