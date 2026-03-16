/**
 * React Query hooks for Analytics
 *
 * Provides optimized data fetching for dashboard metrics and reports.
 */

import { useQuery } from "@tanstack/react-query";
import { analyticsApi, type AnalyticsParams } from "@/lib/api/analytics";
import { analyticsKeys } from "@/lib/query/query-keys";

/**
 * Fetch dashboard metrics
 */
export function useDashboardMetrics() {
  return useQuery({
    queryKey: analyticsKeys.metrics(),
    queryFn: () => analyticsApi.getDashboardMetrics(),
    staleTime: 1 * 60 * 1000, // 1 minute (metrics change frequently)
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Fetch sales chart data
 */
export function useSalesChart(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: [...analyticsKeys.charts(), "sales", params],
    queryFn: () => analyticsApi.getSalesChart(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch top performing products
 */
export function useTopProducts(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: [...analyticsKeys.all, "top-products", params],
    queryFn: () => analyticsApi.getTopProducts(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch top customers
 */
export function useTopCustomers(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: [...analyticsKeys.all, "top-customers", params],
    queryFn: () => analyticsApi.getTopCustomers(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch inventory status
 */
export function useInventoryStatus() {
  return useQuery({
    queryKey: [...analyticsKeys.all, "inventory-status"],
    queryFn: () => analyticsApi.getInventoryStatus(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Fetch order status distribution
 */
export function useOrderStatusDistribution() {
  return useQuery({
    queryKey: [...analyticsKeys.all, "order-status-distribution"],
    queryFn: () => analyticsApi.getOrderStatusDistribution(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch revenue by category
 */
export function useRevenueByCategory(params: AnalyticsParams = {}) {
  return useQuery({
    queryKey: [...analyticsKeys.all, "revenue-by-category", params],
    queryFn: () => analyticsApi.getRevenueByCategory(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
