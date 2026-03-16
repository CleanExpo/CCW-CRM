/**
 * Autonomy Metrics API Client
 *
 * TypeScript client for the /api/autonomy/* backend endpoints.
 * Provides agent performance metrics, health status, and anomaly detection.
 */

import { apiClient } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutonomyMetrics {
  total_actions: number;
  total_prs_created: number;
  total_auto_merged: number;
  total_rejected: number;
  total_blocked: number;
  auto_merge_success_rate: number;
  test_pass_rate: number;
  protected_file_violations: number;
  rate_limit_hits: number;
  circuit_breaker_trips: number;
  auto_merge_reversions: number;
  risk_distribution: Record<string, number>;
  avg_duration_ms: number;
}

export interface AutonomyHealth {
  status: "healthy" | "degraded" | "unhealthy";
  metrics: {
    success_rate: number;
    error_rate: number;
    test_pass_rate: number;
    total_actions: number;
    total_auto_merged: number;
  };
  issues: string[];
  timestamp: string;
}

export interface AutonomyAnomalies {
  window_hours: number;
  anomalies: string[];
  has_anomalies: boolean;
  anomaly_count: number;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function getAutonomyMetrics(
  windowHours: number = 24
): Promise<AutonomyMetrics> {
  return apiClient.get<AutonomyMetrics>(
    `/api/autonomy/metrics?window_hours=${windowHours}`
  );
}

export async function getAutonomyHealth(
  windowHours: number = 1
): Promise<AutonomyHealth> {
  return apiClient.get<AutonomyHealth>(
    `/api/autonomy/health?window_hours=${windowHours}`
  );
}

export async function getAutonomyAnomalies(
  windowHours: number = 24
): Promise<AutonomyAnomalies> {
  return apiClient.get<AutonomyAnomalies>(
    `/api/autonomy/anomalies?window_hours=${windowHours}`
  );
}
