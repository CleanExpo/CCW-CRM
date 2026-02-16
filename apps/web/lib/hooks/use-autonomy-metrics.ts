/**
 * React hook for fetching and polling autonomy metrics.
 *
 * Fetches metrics, health, and anomalies from the /api/autonomy/* endpoints
 * and auto-refreshes every 30 seconds.
 */

import { useCallback, useEffect, useState } from "react";
import {
  getAutonomyMetrics,
  getAutonomyHealth,
  getAutonomyAnomalies,
  type AutonomyMetrics,
  type AutonomyHealth,
  type AutonomyAnomalies,
} from "@/lib/api/autonomy";

/** Polling interval in milliseconds (30 seconds) */
const POLL_INTERVAL_MS = 30_000;

interface UseAutonomyMetricsReturn {
  metrics: AutonomyMetrics | null;
  health: AutonomyHealth | null;
  anomalies: AutonomyAnomalies | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAutonomyMetrics(
  windowHours: number = 24
): UseAutonomyMetricsReturn {
  const [metrics, setMetrics] = useState<AutonomyMetrics | null>(null);
  const [health, setHealth] = useState<AutonomyHealth | null>(null);
  const [anomalies, setAnomalies] = useState<AutonomyAnomalies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [metricsData, healthData, anomaliesData] = await Promise.all([
        getAutonomyMetrics(windowHours),
        getAutonomyHealth(Math.min(windowHours, 24)),
        getAutonomyAnomalies(windowHours),
      ]);

      setMetrics(metricsData);
      setHealth(healthData);
      setAnomalies(anomaliesData);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load autonomy metrics");
    } finally {
      setLoading(false);
    }
  }, [windowHours]);

  // Initial fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Polling
  useEffect(() => {
    const interval = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { metrics, health, anomalies, loading, error, refresh: fetchAll };
}
