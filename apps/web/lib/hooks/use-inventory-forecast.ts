/**
 * Inventory Forecast Hook
 *
 * React hook for AI-powered inventory forecasting and reorder recommendations.
 */

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";

// Types
export interface SalesVelocity {
  avg_daily_sales: number;
  total_sold: number;
  order_count: number;
  days_of_data: number;
}

export interface ForecastData {
  days_until_depletion: number | null;
  depletion_date: string | null;
  reorder_point: number;
  safety_stock: number;
}

export interface RecommendationData {
  needs_reorder: boolean;
  urgency: "critical" | "high" | "medium" | "low";
  recommended_order_qty: number;
  estimated_cost: number | null;
}

export interface SeasonalPattern {
  pattern_detected: boolean;
  peak_months: string[];
  trough_months: string[];
  avg_monthly_sales: number;
}

export interface ProductForecast {
  product_id: string;
  product_name: string;
  sku: string;
  current_stock: number;
  sales_velocity: SalesVelocity;
  forecast: ForecastData;
  recommendation: RecommendationData;
  seasonal_pattern: SeasonalPattern | null;
  confidence: number;
}

export interface InventoryForecastData {
  forecasts: ProductForecast[];
  reorder_recommendations: ProductForecast[];
  total_products_analyzed: number;
  confidence: number;
}

export interface InventoryForecastOptions {
  productId?: string;
  forecastDays?: number;
  includeSeasonal?: boolean;
  autoFetch?: boolean;
}

export interface UseInventoryForecastReturn {
  data: InventoryForecastData | null;
  loading: boolean;
  error: Error | null;
  fetchForecast: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for inventory forecasting with AI recommendations.
 *
 * @param options - Configuration options
 * @returns Forecast data, loading state, error, and fetch functions
 *
 * @example
 * ```tsx
 * // Forecast all products
 * const { data, loading, error, refetch } = useInventoryForecast({
 *   autoFetch: true,
 * });
 *
 * // Forecast specific product
 * const { data, loading, fetchForecast } = useInventoryForecast({
 *   productId: "product-uuid",
 *   forecastDays: 60,
 *   autoFetch: false,
 * });
 * ```
 */
export function useInventoryForecast(
  options: InventoryForecastOptions = {}
): UseInventoryForecastReturn {
  const {
    productId,
    forecastDays = 30,
    includeSeasonal = true,
    autoFetch = false,
  } = options;

  const [data, setData] = useState<InventoryForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{
        forecasts: ProductForecast[];
        reorder_recommendations: ProductForecast[];
        total_products_analyzed: number;
        confidence: number;
      }>("/api/ai/inventory-forecast", {
        product_id: productId || null,
        forecast_days: forecastDays,
        include_seasonal: includeSeasonal,
      });

      setData({
        forecasts: response.forecasts,
        reorder_recommendations: response.reorder_recommendations,
        total_products_analyzed: response.total_products_analyzed,
        confidence: response.confidence,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Forecast failed");
      setError(error);
      console.error("Inventory forecast failed:", error);
    } finally {
      setLoading(false);
    }
  }, [productId, forecastDays, includeSeasonal]);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchForecast();
    }
  }, [autoFetch, fetchForecast]);

  return {
    data,
    loading,
    error,
    fetchForecast,
    refetch: fetchForecast,
  };
}

/**
 * Hook for fetching low-stock products only.
 *
 * @param thresholdDays - Days until stockout threshold
 * @returns Low-stock products and reorder recommendations
 *
 * @example
 * ```tsx
 * const { data, loading, refetch } = useLowStockForecast(14);
 * // Returns products that will run out within 14 days
 * ```
 */
export function useLowStockForecast(
  thresholdDays: number = 30
): UseInventoryForecastReturn {
  const [data, setData] = useState<InventoryForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<{
        forecasts: ProductForecast[];
        reorder_recommendations: ProductForecast[];
        total_products_analyzed: number;
        confidence: number;
      }>(
        `/api/ai/inventory-forecast/low-stock?threshold_days=${thresholdDays}&forecast_days=30`
      );

      setData({
        forecasts: response.forecasts,
        reorder_recommendations: response.reorder_recommendations,
        total_products_analyzed: response.total_products_analyzed,
        confidence: response.confidence,
      });
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Low-stock forecast failed");
      setError(error);
      console.error("Low-stock forecast failed:", error);
    } finally {
      setLoading(false);
    }
  }, [thresholdDays]);

  return {
    data,
    loading,
    error,
    fetchForecast,
    refetch: fetchForecast,
  };
}
