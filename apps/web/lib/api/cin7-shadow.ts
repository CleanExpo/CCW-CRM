/**
 * Cin7 Shadow Sync API Client
 *
 * Type-safe client for the Shadow Transition System endpoints (UNI-1260).
 * Handles shadow polling, status queries, gap listing, and gap resolution.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Cin7ShadowStatus {
  total_synced: number;
  total_gaps: number;
  total_conflicts: number;
  last_poll_at: string | null;
  gap_by_entity: Record<string, number>;
}

export interface Cin7SyncGap {
  id: string;
  shadow_sync_id: string;
  gap_type: string;
  entity_type: string;
  cin7_id: string;
  erp_id: string | null;
  field_name: string | null;
  cin7_value: string | null;
  erp_value: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
  detected_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface Cin7GapListResponse {
  items: Cin7SyncGap[];
  total: number;
  page: number;
  page_size: number;
}

export interface Cin7GapSummaryItem {
  entity_type: string;
  severity: string;
  count: number;
}

export interface Cin7ShadowPollResult {
  status: string;
  mode: string;
  polled_at: string;
  // demo mode fields
  records_checked?: number;
  records_synced?: number;
  records_gap?: number;
  records_conflict?: number;
  gaps_detected?: number;
  // live mode fields
  total_checked?: number;
  total_synced?: number;
  total_gap?: number;
  total_conflict?: number;
  elapsed_ms?: number;
  errors?: string[];
  message?: string;
}

export interface Cin7GapUpdateRequest {
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
  resolution_notes?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Trigger a shadow poll to detect gaps between Cin7 and ERP.
 *
 * In demo mode this creates 5 realistic demo records.
 * In live mode this is a stub until the full poller is implemented.
 */
export async function triggerShadowPoll(): Promise<Cin7ShadowPollResult> {
  return apiClient.post<Cin7ShadowPollResult>('/api/cin7/shadow/poll');
}

/**
 * Get a summary of the current shadow sync state.
 *
 * Returns totals for synced / gap / conflict records and a per-entity
 * breakdown of gap counts.
 */
export async function getShadowStatus(): Promise<Cin7ShadowStatus> {
  return apiClient.get<Cin7ShadowStatus>('/api/cin7/shadow/status');
}

/**
 * List open and investigating Cin7SyncGap records.
 *
 * @param page       Page number (1-indexed)
 * @param pageSize   Results per page (max 100)
 * @param entityType Optional filter: product | customer | order | quote | supplier | purchase_order
 * @param severity   Optional filter: low | medium | high | critical
 */
export async function listSyncGaps(
  page: number = 1,
  pageSize: number = 20,
  entityType?: string,
  severity?: string
): Promise<Cin7GapListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (entityType) params.set('entity_type', entityType);
  if (severity) params.set('severity', severity);

  return apiClient.get<Cin7GapListResponse>(`/api/cin7/shadow/gaps?${params.toString()}`);
}

/**
 * Get gap counts grouped by entity_type and severity.
 */
export async function getSyncGapsSummary(): Promise<Cin7GapSummaryItem[]> {
  return apiClient.get<Cin7GapSummaryItem[]>('/api/cin7/shadow/gaps/summary');
}

/**
 * Update the status of a specific sync gap.
 *
 * @param gapId            UUID of the Cin7SyncGap record
 * @param status           New status: open | investigating | resolved | ignored
 * @param resolutionNotes  Optional text explaining the resolution
 */
export async function updateGapStatus(
  gapId: string,
  status: 'open' | 'investigating' | 'resolved' | 'ignored',
  resolutionNotes?: string
): Promise<Cin7SyncGap> {
  const body: Cin7GapUpdateRequest = { status };
  if (resolutionNotes !== undefined) {
    body.resolution_notes = resolutionNotes;
  }
  return apiClient.patch<Cin7SyncGap>(`/api/cin7/shadow/gaps/${gapId}`, body);
}
