/**
 * Analytics API Client
 *
 * Provides access to dashboard metrics, charts, and reports.
 */

import { apiClient } from "./client";

/**
 * Dashboard metrics interface
 */
export interface DashboardMetrics {
  total_orders: number;
  total_customers: number;
  total_revenue: string;
  total_sales: number;
  orders_this_month: number;
  revenue_this_month: string;
  new_customers_this_month: number;
  pending_quotes: number;
}

/**
 * Sales chart data point
 */
export interface SalesDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

/**
 * Product performance data
 */
export interface ProductPerformance {
  product_id: string;
  product_name: string;
  sku: string;
  total_quantity: number;
  total_revenue: string;
  order_count: number;
}

/**
 * Customer performance data
 */
export interface CustomerPerformance {
  customer_id: string;
  customer_name: string;
  total_orders: number;
  total_revenue: string;
  last_order_date: string;
}

/**
 * Inventory status
 */
export interface InventoryStatus {
  product_id: string;
  product_name: string;
  sku: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  reorder_level: number;
  needs_reorder: boolean;
}

/**
 * Order status distribution
 */
export interface OrderStatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

/**
 * Analytics query params
 */
export interface AnalyticsParams {
  start_date?: string;
  end_date?: string;
  period?: "day" | "week" | "month" | "year";
  limit?: number;
}

/**
 * Analytics API client
 */
export const analyticsApi = {
  /**
   * Get dashboard overview metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return apiClient.get<DashboardMetrics>("/api/analytics/dashboard");
  },

  /**
   * Get sales chart data
   */
  async getSalesChart(params: AnalyticsParams = {}): Promise<SalesDataPoint[]> {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);
    if (params.period) queryParams.append("period", params.period);

    return apiClient.get<SalesDataPoint[]>(`/api/analytics/sales-chart?${queryParams.toString()}`);
  },

  /**
   * Get top performing products
   */
  async getTopProducts(params: AnalyticsParams = {}): Promise<ProductPerformance[]> {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);
    if (params.limit) queryParams.append("limit", params.limit.toString());

    return apiClient.get<ProductPerformance[]>(
      `/api/analytics/top-products?${queryParams.toString()}`
    );
  },

  /**
   * Get top customers by revenue
   */
  async getTopCustomers(params: AnalyticsParams = {}): Promise<CustomerPerformance[]> {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);
    if (params.limit) queryParams.append("limit", params.limit.toString());

    return apiClient.get<CustomerPerformance[]>(
      `/api/analytics/top-customers?${queryParams.toString()}`
    );
  },

  /**
   * Get inventory status (low stock alerts)
   */
  async getInventoryStatus(): Promise<InventoryStatus[]> {
    return apiClient.get<InventoryStatus[]>("/api/analytics/inventory-status");
  },

  /**
   * Get order status distribution
   */
  async getOrderStatusDistribution(): Promise<OrderStatusDistribution[]> {
    return apiClient.get<OrderStatusDistribution[]>("/api/analytics/order-status-distribution");
  },

  /**
   * Get revenue by category
   */
  async getRevenueByCategory(params: AnalyticsParams = {}): Promise<Array<{
    category: string;
    revenue: string;
    percentage: number;
  }>> {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append("start_date", params.start_date);
    if (params.end_date) queryParams.append("end_date", params.end_date);

    return apiClient.get(`/api/analytics/revenue-by-category?${queryParams.toString()}`);
  },
};
