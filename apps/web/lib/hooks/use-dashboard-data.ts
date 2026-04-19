import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { getDashboardInsights, type Insight } from '@/lib/api/ai-insights';
import { usePOSFailureAlerts, useDashboardMetricsStream } from '@/lib/hooks/use-sse';
import { useToast } from '@/hooks/use-toast';

export interface DashboardMetrics {
  total_revenue_this_month: string;
  active_orders: number;
  total_products: number;
  total_customers: number;
  low_stock_alerts: number;
  pending_quotes: number;
}

export interface RevenueDataPoint {
  month: string;
  revenue: string;
}

export interface CategorySales {
  category: string;
  value: string;
  percentage: number;
}

export interface TopProduct {
  name: string;
  revenue: string;
  quantity_sold: number;
}

export interface ActivityItem {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  status: string | null;
}

interface InventoryDataPoint {
  warehouse: string;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
}

interface AggregatedDashboardData {
  metrics: DashboardMetrics;
  revenue_chart: RevenueDataPoint[];
  category_sales: CategorySales[];
  top_products: TopProduct[];
  inventory_status: InventoryDataPoint[];
  recent_activity: ActivityItem[];
}

export function useDashboardData() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [posFailureCount, setPosFailureCount] = useState(0);

  const { data: posFailure, status: posAlertStatus } = usePOSFailureAlerts(true);
  const { data: metricsUpdate, status: metricsStreamStatus } = useDashboardMetricsStream(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [dashboardData, insightsData, posFailures] = await Promise.all([
          apiClient.get<AggregatedDashboardData>('/api/dashboard/aggregated'),
          getDashboardInsights(3).catch(() => ({ insights: [], total: 0, categories: [] })),
          apiClient
            .get<{ alert_count: number }>('/api/monitoring/alerts/pos-failures?hours=24')
            .catch(() => ({ alert_count: 0 })),
        ]);
        setMetrics(dashboardData.metrics);
        setRevenueData(dashboardData.revenue_chart);
        setCategorySales(dashboardData.category_sales);
        setTopProducts(dashboardData.top_products);
        setActivity(dashboardData.recent_activity);
        setInsights(insightsData.insights.filter((i) => i.priority === 'high').slice(0, 3));
        setPosFailureCount(posFailures.alert_count);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        setMetrics(null);
        setRevenueData([]);
        setCategorySales([]);
        setTopProducts([]);
        setActivity([]);
        setInsights([]);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (posFailure) {
      console.log('POS failure detected:', posFailure);
      setPosFailureCount((prev) => prev + 1);
      toast({
        title: 'POS Payment Failed',
        description: `Transaction ${posFailure.transaction_number} at ${posFailure.location_code} failed: ${posFailure.error}`,
        variant: 'destructive',
      });
    }
  }, [posFailure, toast]);

  useEffect(() => {
    if (metricsUpdate) {
      console.log('Dashboard metric updated:', metricsUpdate);
      async function refreshMetrics() {
        try {
          const dashboardData = await apiClient.get<AggregatedDashboardData>(
            '/api/dashboard/aggregated'
          );
          setMetrics(dashboardData.metrics);
          setActivity(dashboardData.recent_activity);
        } catch (error) {
          console.error('Failed to refresh metrics:', error);
        }
      }
      const timeout = setTimeout(refreshMetrics, 500);
      return () => clearTimeout(timeout);
    }
  }, [metricsUpdate]);

  return {
    metrics,
    revenueData,
    categorySales,
    topProducts,
    activity,
    insights,
    loading,
    posFailureCount,
    posAlertStatus,
    metricsStreamStatus,
  };
}
