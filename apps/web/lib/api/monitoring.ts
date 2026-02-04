/**
 * Monitoring API client functions.
 */

import { apiClient } from "./client";

// ─── Types ─────────────────────────────────────────────────────

export interface Alert {
  id: number;
  type: string;
  severity: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  metadata: Record<string, any>;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
}

export interface BusinessMetrics {
  pos: {
    today: {
      transaction_count: number;
      total_volume: number;
      average_value: number;
    };
    this_week: {
      transaction_count: number;
      total_volume: number;
    };
    this_month: {
      transaction_count: number;
      total_volume: number;
    };
    payment_failures_24h: number;
    failure_rate_percent: number;
  };
  reconciliation: {
    total_feeds_7d: number;
    reconciled_7d: number;
    unreconciled_total: number;
    success_rate_percent: number;
  };
  orders: {
    by_status: {
      draft: number;
      pending: number;
      confirmed: number;
      processing: number;
      shipped: number;
      delivered: number;
      cancelled: number;
    };
    today_count: number;
    this_week: {
      count: number;
      total_value: number;
      average_value: number;
    };
    orders_per_hour_24h: number;
  };
  timestamp: string;
}

export interface EndpointStats {
  endpoint: string;
  request_count: number;
  error_count: number;
  error_rate: number;
  avg_response_time_ms: number;
  p50_response_time_ms: number;
  p95_response_time_ms: number;
  p99_response_time_ms: number;
}

export interface PerformanceStats {
  total_requests: number;
  total_errors: number;
  overall_error_rate: number;
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  unique_endpoints: number;
}

// ─── Alert Management ──────────────────────────────────────────

export async function getAlerts(params?: {
  alert_type?: string;
  severity?: string;
  acknowledged?: boolean;
}): Promise<{ alerts: Alert[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.alert_type) searchParams.set("alert_type", params.alert_type);
  if (params?.severity) searchParams.set("severity", params.severity);
  if (params?.acknowledged !== undefined)
    searchParams.set("acknowledged", params.acknowledged.toString());

  const query = searchParams.toString();
  const url = `/api/monitoring/alerts${query ? `?${query}` : ""}`;

  return apiClient.get(url);
}

export async function createAlert(data: {
  alert_type: string;
  severity: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  metadata?: Record<string, any>;
  send_notification?: boolean;
}): Promise<Alert> {
  return apiClient.post("/api/monitoring/alerts", data);
}

export async function acknowledgeAlert(alertId: number): Promise<{ success: boolean }> {
  return apiClient.post(`/api/monitoring/alerts/${alertId}/acknowledge`, {});
}

export async function resolveAlert(alertId: number): Promise<{ success: boolean }> {
  return apiClient.post(`/api/monitoring/alerts/${alertId}/resolve`, {});
}

export async function clearOldAlerts(days: number = 30): Promise<{ cleared_count: number }> {
  return apiClient.delete(`/api/monitoring/alerts/clear-old?days=${days}`);
}

// ─── Business Metrics ──────────────────────────────────────────

export async function getBusinessMetrics(): Promise<BusinessMetrics> {
  return apiClient.get("/api/monitoring/business/summary");
}

export async function getPOSMetrics(): Promise<BusinessMetrics["pos"]> {
  return apiClient.get("/api/monitoring/business/pos");
}

export async function getReconciliationMetrics(): Promise<BusinessMetrics["reconciliation"]> {
  return apiClient.get("/api/monitoring/business/reconciliation");
}

export async function getOrderMetrics(): Promise<BusinessMetrics["orders"]> {
  return apiClient.get("/api/monitoring/business/orders");
}

// ─── API Performance ───────────────────────────────────────────

export async function getPerformanceStats(): Promise<PerformanceStats> {
  return apiClient.get("/api/monitoring/performance");
}

export async function getAllEndpointStats(
  limit: number = 100
): Promise<{ endpoints: EndpointStats[]; total: number }> {
  return apiClient.get(`/api/monitoring/performance/endpoints?limit=${limit}`);
}

export async function getSlowestEndpoints(
  limit: number = 10
): Promise<{ endpoints: EndpointStats[]; total: number }> {
  return apiClient.get(`/api/monitoring/performance/slowest?limit=${limit}`);
}

export async function getErrorEndpoints(
  minErrorRate: number = 1.0
): Promise<{ endpoints: EndpointStats[]; total: number }> {
  return apiClient.get(`/api/monitoring/performance/errors?min_error_rate=${minErrorRate}`);
}

export async function getEndpointStats(method: string, path: string): Promise<EndpointStats> {
  const params = new URLSearchParams({ method, path });
  return apiClient.get(`/api/monitoring/performance/endpoint?${params.toString()}`);
}
