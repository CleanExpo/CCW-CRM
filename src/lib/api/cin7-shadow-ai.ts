/**
 * Cin7 Shadow AI API Client
 *
 * Type-safe client for the Shadow Transition System Phase C AI endpoints
 * (UNI-1262). Provides gap analysis and auto-resolution capabilities.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShadowAiEntitySummaryItem {
  entity_type: string;
  severity: string;
  count: number;
}

export interface ShadowAiRecommendation {
  entity_type: string;
  gap_count: number;
  /** 0 = ok (green), 1 = critical (red), 2 = high (orange), 3 = normal (default) */
  priority: number;
  recommendation: string;
}

export interface ShadowAiAnalysis {
  entity_summary: ShadowAiEntitySummaryItem[];
  total_gaps: number;
  critical_count: number;
  recommendations: ShadowAiRecommendation[];
  analyzed_at: string;
}

export interface ShadowAutoResolveResult {
  resolved_count: number;
  message: string;
  resolved_at: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Trigger an AI-driven gap analysis.
 *
 * Queries the backend for open Cin7SyncGap records, classifies them by
 * entity type + severity, and returns prioritised recommendations.
 * Falls back to demo data when the backend is unavailable.
 */
export async function analyzeShadowGaps(): Promise<ShadowAiAnalysis> {
  return apiClient.get<ShadowAiAnalysis>('/api/ai/shadow/analyze');
}

/**
 * Auto-resolve open gaps that have been stale for longer than `daysOld` days.
 *
 * @param daysOld  Minimum age in days before a gap is auto-resolved (default: 7)
 */
export async function autoResolveStaleShadowGaps(
  daysOld: number = 7
): Promise<ShadowAutoResolveResult> {
  return apiClient.post<ShadowAutoResolveResult>('/api/ai/shadow/auto-resolve', {
    days_old: daysOld,
  });
}

/**
 * Check Cin7 Shadow AI agent health.
 */
export async function getShadowAiHealth(): Promise<{
  status: string;
  agent: string;
  version: string;
}> {
  return apiClient.get<{ status: string; agent: string; version: string }>('/api/ai/shadow/health');
}
