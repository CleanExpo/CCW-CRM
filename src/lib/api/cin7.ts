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
  /** Client-facing: complete | incomplete (legacy idle/failed/running normalized by API). */
  status: string;
  records_processed: number;
  /** ISO timestamp of last sync; null when the entity has never been synced. */
  synced_at: string | null;
  error_message?: string;
  last_committed_page?: number;
  failed_page?: number | null;
  next_page?: number | null;
  completed_at?: string | null;
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

export type Cin7SyncResult = {
  status: string;
  records_processed?: number;
  duration_ms?: number;
  page_size?: number;
  cin7_source_styles?: number;
  skipped?: Record<string, number>;
  complete?: boolean;
  next_page?: number | null;
  failed_page?: number | null;
  last_committed_page?: number;
  sync_errors?: string[];
  /** Live / recon Cin7 expected count when known. */
  cin7_count?: number;
  /** Short per-entity line when sync is short of Cin7 — click Continue. */
  completeness_message?: string;
};

export type Cin7SyncEntityType =
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
  | 'inventory';

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Trigger manual sync for a specific entity type.
 * Auto-resumes chunks while incomplete; retries brief page errors so one click
 * can finish large catalogs without leaving "incomplete" after every timeout.
 */
export async function triggerCin7Sync(
  entityType: Cin7SyncEntityType,
  options?: { restart?: boolean; full?: boolean; maxChunks?: number; signal?: AbortSignal }
): Promise<Cin7SyncResult> {
  const maxChunks = options?.maxChunks ?? 8;
  let last: Cin7SyncResult | null = null;
  // Default resume — never wipe checkpoint unless caller asks for restart.
  let restart = options?.restart ?? false;
  const forceFull = options?.full === true;
  let pageErrorRetries = 0;
  const maxPageErrorRetries = 3;

  for (let chunk = 0; chunk < maxChunks; chunk += 1) {
    if (options?.signal?.aborted) {
      throw new Error('Sync canceled');
    }
    const params = new URLSearchParams();
    if (restart && chunk === 0) params.set('restart', 'true');
    // full=true on every chunk of a forced full walk (mode is re-evaluated each request).
    if (forceFull) params.set('full', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    try {
      last = await apiClient.post<Cin7SyncResult>(
        `/api/integrations/cin7/sync/${entityType}${qs}`,
        undefined,
        undefined,
        300_000
      );
    } catch (error: unknown) {
      // Legacy 409 lock — treat as running so until-complete can wait (no error spam).
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        (error as { status: number }).status === 409
      ) {
        return {
          status: 'running',
          complete: false,
          sync_errors: [
            error instanceof Error ? error.message : 'Sync already in progress for this entity.',
          ],
        };
      }
      throw error;
    }
    restart = false;

    if (last.complete === true || last.status === 'complete') {
      return last;
    }
    // Concurrent lock (200 or legacy 409) — stop this chunk loop; caller waits.
    if (last.status === 'running') {
      return last;
    }
    // Transient page error — brief backoff then resume from checkpoint.
    if (last.failed_page != null && last.complete === false && last.next_page != null) {
      if (pageErrorRetries < maxPageErrorRetries) {
        pageErrorRetries += 1;
        const rateLimited = (last.sync_errors ?? []).some((e) => /429|rate-?limit/i.test(e));
        await sleepMs(rateLimited ? 15_000 : 5_000 * pageErrorRetries);
        continue;
      }
      return last;
    }
    if (last.complete === false && last.next_page != null) {
      pageErrorRetries = 0;
      continue;
    }
    return last;
  }

  return last ?? { status: 'incomplete', complete: false };
}

/**
 * Keep syncing one entity until complete (or give up after maxRounds).
 * Used by Sync buttons and the client scheduled runner so one action finishes the job.
 */
export async function syncCin7EntityUntilComplete(
  entityType: Cin7SyncEntityType,
  options?: {
    restart?: boolean;
    full?: boolean;
    maxRounds?: number;
    maxChunksPerRound?: number;
    signal?: AbortSignal;
    onProgress?: (result: Cin7SyncResult, round: number) => void;
  }
): Promise<Cin7SyncResult> {
  const maxRounds = options?.maxRounds ?? 40;
  let restart = options?.restart ?? false;
  let last: Cin7SyncResult = { status: 'incomplete', complete: false };

  for (let round = 0; round < maxRounds; round += 1) {
    if (options?.signal?.aborted) {
      throw new Error('Sync canceled');
    }
    last = await triggerCin7Sync(entityType, {
      restart,
      full: options?.full,
      maxChunks: options?.maxChunksPerRound ?? 8,
      signal: options?.signal,
    });
    restart = false;
    options?.onProgress?.(last, round);

    if (last.complete === true || last.status === 'complete') {
      return last;
    }
    if (last.status === 'running') {
      // Another request holds the lock (common for tax-codes while it finishes).
      await sleepMs(20_000);
      continue;
    }
    if (last.complete === false && last.next_page != null) {
      continue;
    }
    return last;
  }

  return last;
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
      mode?: 'live' | 'acceptance';
    };
    recon_status?: string;
    blocked_reason?: string | null;
    incomplete_sync?: boolean;
    cin7_snapshot_complete?: boolean;
    optix_complete?: boolean;
    recon_run_id?: string | null;
    read_only?: boolean;
    owner_scope_note?: string;
    mode?: string;
  };

/**
 * Compare Cin7 live counts with Optix imported master data.
 * Uses a server-side cache by default; pass force=true to pull fresh data from Cin7.
 * mode=acceptance runs the fail-closed DB gate used for Phase 1 sign-off.
 */
export async function getCin7Reconciliation(options?: {
  force?: boolean;
  mode?: 'live' | 'acceptance';
}): Promise<Cin7ReconciliationResponse> {
  const params = new URLSearchParams();
  if (options?.force) params.set('force', 'true');
  if (options?.mode) params.set('mode', options.mode);
  const qs = params.toString();
  return apiClient.get(
    `/api/integrations/cin7/reconciliation${qs ? `?${qs}` : ''}`,
    undefined,
    300_000
  );
}

/** Explicit field heal (audited + reversible). Never runs inside reconciliation. */
export async function healCin7FieldMismatches(options?: {
  entities?: Array<
    'products' | 'customers' | 'suppliers' | 'branches' | 'internal-customers' | 'stock'
  >;
}): Promise<{
  healed_total: number;
  summary: string;
  audit_run_id: string;
  by_entity: {
    products: { healed: number; checked: number };
    customers: { healed: number; checked: number };
    suppliers: { healed: number; checked: number };
    branches: { healed: number; checked: number };
    internal_customers: { healed: number; checked: number };
    stock: { healed: number; checked: number };
  };
  errors: string[];
  accepted?: boolean;
  reversible?: boolean;
}> {
  return apiClient.post(
    '/api/integrations/cin7/field-heal',
    options?.entities ? { entities: options.entities } : {},
    undefined,
    300_000
  );
}

/** Preview (default) or apply stock surplus prune (audited + reversible on apply). */
export async function pruneCin7StockSurplus(options?: { dryRun?: boolean }): Promise<{
  audit_run_id: string | null;
  cin7_keys: number;
  optix_before: number;
  deleted: number;
  missing_in_optix: number;
  errors: string[];
  dry_run: boolean;
  optix_after?: number;
  accepted?: boolean;
  reversible?: boolean;
}> {
  const dryRun = options?.dryRun !== false;
  if (dryRun) {
    return apiClient.get('/api/integrations/cin7/stock-prune?dry_run=true', undefined, 300_000);
  }
  return apiClient.post('/api/integrations/cin7/stock-prune', {}, undefined, 300_000);
}

export async function revertCin7HealAudit(auditRunId: string): Promise<{
  reverted: number;
  action_type: string;
  accepted?: boolean;
}> {
  return apiClient.post(
    '/api/integrations/cin7/heal-audit/revert',
    { audit_run_id: auditRunId },
    undefined,
    300_000
  );
}

export async function listCin7ReconHistory(limit = 20): Promise<{
  owner_user_id: string;
  note: string;
  items: Array<{
    id: string;
    mode: string;
    status: string;
    checked_at: string;
    immutable: boolean;
    missing_count: number;
    extra_count: number;
    field_mismatch_count: number;
    products_cin7: number | null;
    products_optix: number | null;
    stock_cin7: number | null;
    stock_optix: number | null;
    stock_reported_total: number | null;
    stock_truncated: boolean;
  }>;
}> {
  return apiClient.get(`/api/integrations/cin7/reconciliation/history?limit=${limit}`);
}

export async function getCin7ReconSnapshot(
  reconRunId: string
): Promise<Cin7ReconciliationResponse> {
  return apiClient.get(
    `/api/integrations/cin7/reconciliation/history?id=${encodeURIComponent(reconRunId)}`
  );
}

export async function getCin7B1Residuals(): Promise<{
  recon_run_id: string | null;
  checked_at: string | null;
  note: string;
  counts: Record<string, { missing: number; extra: number }>;
  items: Array<{
    entity_type: string;
    cin7_id: string;
    label: string;
    reason: string;
    explanation: string;
  }>;
}> {
  return apiClient.get('/api/integrations/cin7/reconciliation/residuals');
}

export function getCin7B1ResidualsExportUrl(): string {
  return '/api/integrations/cin7/reconciliation/residuals?format=csv';
}

export async function getCin7StockStability(): Promise<{
  stable: boolean;
  prune_enabled: boolean;
  required: number;
  observed: number;
  cin7_counts: Array<number | null>;
  reason: string;
  runs: Array<{
    id: string;
    checked_at: string;
    status: string;
    stock_cin7: number | null;
    stock_optix: number | null;
    cin7_reported_total: number | null;
    truncated: boolean;
    complete: boolean;
  }>;
  last_prune_audit: {
    id: string;
    created_at: string;
    deleted_total: number;
    status: string;
    reversible: boolean;
  } | null;
  revert_how: string;
}> {
  return apiClient.get('/api/integrations/cin7/reconciliation/stock-stability');
}

/** @deprecated Prefer healCin7FieldMismatches — products-only wrapper. */
export async function healCin7ProductFieldMismatches(): Promise<{
  healed: number;
  checked: number;
  cin7_skus: number;
  mismatched_before: number;
  breakdown_before: {
    name: number;
    price: number;
    stock: number;
    is_active: number;
    visibility: number;
  };
  errors: string[];
  accepted?: boolean;
}> {
  return apiClient.post('/api/integrations/cin7/product-heal', undefined, undefined, 300_000);
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
 * Get latest sync status for every Cin7 syncable entity (one row each).
 */
export async function getCin7SyncLogs(_limit: number = 20): Promise<{ logs: Cin7SyncLog[] }> {
  // Must use /sync-history — /sync/logs is gitignored and also collides with POST /sync/[entityType] (405).
  // Server always returns the full entity set; limit is kept for call-site compatibility.
  return apiClient.get(`/api/integrations/cin7/sync-history`);
}

/** Nightly sync proof ledger (consecutive complete runs). */
export async function getCin7SyncProof(limit = 10): Promise<{
  consecutive_complete_count: number;
  proof_ready: boolean;
  required_consecutive: number;
  ledger: Array<{
    id: string;
    started_at: string;
    finished_at: string | null;
    overall_status: string;
    consecutive_complete_count: number;
    entity_results: unknown;
  }>;
}> {
  return apiClient.get(`/api/integrations/cin7/sync-proof?limit=${limit}`);
}

export type Cin7ScheduledSyncStatus = {
  source: 'server';
  schedule: { raw: string; kind: 'once' | 'daily' | 'twice-daily'; time_zone: string | null };
  next_fire_at: string | null;
  countdown: string | null;
  running: boolean;
  current_entity: string | null;
  unattended_owner_is_this_account: boolean;
  armed: boolean;
  live_entities: Array<{
    entity: string;
    status: string;
    records: number;
    updated_at: string;
  }>;
  last_run: {
    id: string;
    started_at: string;
    finished_at: string | null;
    overall_status: string;
    consecutive_complete_count: number;
    entity_results: Record<string, { status?: string; complete?: boolean; records?: number }>;
  } | null;
  note: string;
};

/** Server scheduler status — read-only; does not start a sync. */
export async function getCin7ScheduledSyncStatus(): Promise<Cin7ScheduledSyncStatus> {
  return apiClient.get(`/api/integrations/cin7/scheduled-sync`);
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
