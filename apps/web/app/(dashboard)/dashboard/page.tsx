'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BentoGrid,
  BentoCard,
  BentoCardHeader,
  BentoCardTitle,
  BentoCardDescription,
  BentoCardContent,
} from '@/components/ui/bento-grid';
import { BorderBeam } from '@/components/ui/border-beam';
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  FileText,
  Sparkles,
  ArrowRight,
  Camera,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { getDashboardInsights, type Insight } from '@/lib/api/ai-insights';
// PHASE 4: Real-time POS failure alerts + Dashboard metrics
import {
  usePOSFailureAlerts,
  useDashboardMetricsStream,
  type POSFailureAlert,
  type DashboardMetricsUpdate,
} from '@/lib/hooks/use-sse';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { InsightCard } from '@/components/insights/insight-card';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { CategorySalesChart } from '@/components/charts/CategorySalesChart';
import { StockHealthWidget } from '@/components/dashboard/StockHealthWidget';
import { TransferSuggestionsWidget } from '@/components/dashboard/TransferSuggestionsWidget';
import { OrderStatusBreakdownWidget } from '@/components/dashboard/OrderStatusBreakdownWidget';
import { QuoteConversionWidget } from '@/components/dashboard/QuoteConversionWidget';
import { RevenueByLocationWidget } from '@/components/dashboard/RevenueByLocationWidget';
// PHASE C: AI Sales Insights Widget
import { SalesInsightsWidget } from '@/components/dashboard/SalesInsightsWidget';
// PHASE C: AI Order Patterns Widget
import { OrderPatternsWidget } from '@/components/dashboard/OrderPatternsWidget';
// PHASE 7: Cin7 Sync Status Widget
import { Cin7SyncStatusWidget } from '@/components/dashboard/Cin7SyncStatusWidget';
// NODEJS-Updates: Agent performance metrics widget
import { AgentMetricsWidget } from '@/components/dashboard/AgentMetricsWidget';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface DashboardMetrics {
  total_revenue_this_month: string;
  active_orders: number;
  total_products: number;
  total_customers: number;
  low_stock_alerts: number;
  pending_quotes: number;
}

interface RevenueDataPoint {
  month: string;
  revenue: string;
}

interface CategorySales {
  category: string;
  value: string;
  percentage: number;
}

interface TopProduct {
  name: string;
  revenue: string;
  quantity_sold: number;
}

interface ActivityItem {
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

export default function DashboardPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  // PHASE 4: Real-time POS failure monitoring
  const [posFailureCount, setPosFailureCount] = useState(0);
  const { data: posFailure, status: posAlertStatus } = usePOSFailureAlerts(true);

  // PHASE 4: Real-time dashboard metrics
  const { data: metricsUpdate, status: metricsStreamStatus } = useDashboardMetricsStream(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // PHASE 4 OPTIMIZATION: Use aggregated endpoint (1 API call instead of 6)
        // Expected performance: 70% faster (5-8s → <2s)
        const [dashboardData, insightsData, posFailures] = await Promise.all([
          apiClient.get<AggregatedDashboardData>('/api/dashboard/aggregated'),
          getDashboardInsights(3).catch(() => ({ insights: [], total: 0, categories: [] })),
          apiClient
            .get<{ alert_count: number }>('/api/monitoring/alerts/pos-failures?hours=24')
            .catch(() => ({ alert_count: 0 })),
        ]);

        // Destructure aggregated data
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

  // PHASE 4: Handle real-time POS failure alerts
  useEffect(() => {
    if (posFailure) {
      setPosFailureCount((prev) => prev + 1);
      toast({
        title: 'POS Payment Failed',
        description: `Transaction ${posFailure.transaction_number} at ${posFailure.location_code} failed: ${posFailure.error}`,
        variant: 'destructive',
      });
    }
  }, [posFailure, toast]);

  // PHASE 4: Handle real-time dashboard metrics updates
  useEffect(() => {
    if (metricsUpdate) {
      // Refresh specific metrics based on the update
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

      // Debounce refresh to avoid excessive API calls (wait 500ms before refreshing)
      const timeout = setTimeout(refreshMetrics, 500);
      return () => clearTimeout(timeout);
    }
  }, [metricsUpdate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Equipment Supplier Operations &mdash; CCW Online
          </h1>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-start justify-between"
      >
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              Equipment Supplier Operations &mdash; CCW Online
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              CCW Equipment — Real-time business overview
            </p>
          </div>
          {/* PHASE 4: Live metrics indicator */}
          {metricsStreamStatus === 'connected' && (
            <Badge variant="outline" className="text-xs">
              <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Live Metrics
            </Badge>
          )}
        </div>

        {/* PHASE 4: POS Failure Alert Badge */}
        {posFailureCount > 0 && (
          <Link href="/pos/reconciliation">
            <Card className="border-destructive/50 bg-destructive/10">
              <CardContent className="px-4 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-destructive h-5 w-5" />
                  <div>
                    <p className="text-destructive text-sm font-medium">
                      {posFailureCount} POS {posFailureCount === 1 ? 'Failure' : 'Failures'}
                    </p>
                    <p className="text-muted-foreground text-xs">Last 24 hours</p>
                  </div>
                  {posAlertStatus === 'connected' && (
                    <Badge variant="outline" className="ml-2">
                      Live
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </motion.div>

      {/* Bento Grid Dashboard */}
      <BentoGrid columns={3} gap="lg">
        {/* Metrics Overview - Spans 3 columns */}
        <BentoCard variant="glass" span={3}>
          <BentoCardHeader>
            <BentoCardTitle className="text-2xl">Key Metrics</BentoCardTitle>
            <BentoCardDescription>Real-time business performance indicators</BentoCardDescription>
          </BentoCardHeader>
          <BentoCardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
              {/* Revenue */}
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm font-medium">Total Revenue</span>
                </div>
                <div className="text-brand-primary text-3xl font-bold">
                  {formatCurrency(parseFloat(metrics?.total_revenue_this_month || '0'))}
                </div>
                <p className="text-muted-foreground text-xs">This month from delivered orders</p>
              </div>

              {/* Active Orders */}
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-sm font-medium">Active Orders</span>
                </div>
                <div className="text-3xl font-bold">{metrics?.active_orders || 0}</div>
                <p className="text-muted-foreground text-xs">In progress</p>
              </div>

              {/* Products */}
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="text-sm font-medium">Total Products</span>
                </div>
                <div className="text-3xl font-bold">{metrics?.total_products || 0}</div>
                <p className="text-muted-foreground text-xs">Active catalog items</p>
              </div>

              {/* Customers */}
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Total Customers</span>
                </div>
                <div className="text-3xl font-bold">{metrics?.total_customers || 0}</div>
                <p className="text-muted-foreground text-xs">Active customers</p>
              </div>

              {/* Low Stock */}
              <div className="space-y-2">
                <div className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Low Stock Alerts</span>
                </div>
                <div className="text-destructive text-3xl font-bold">
                  {metrics?.low_stock_alerts || 0}
                </div>
                <p className="text-muted-foreground text-xs">Items with stock ≤ 10</p>
              </div>

              {/* Pending Quotes */}
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">Pending Quotes</span>
                </div>
                <div className="text-3xl font-bold">{metrics?.pending_quotes || 0}</div>
                <p className="text-muted-foreground text-xs">Awaiting response</p>
              </div>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Revenue Chart - Spans 2 columns */}
        <BentoCard variant="glass" span={2} className="min-h-[400px]">
          <RevenueChart data={revenueData} />
        </BentoCard>

        {/* Stock Health Widget - 1 column */}
        <BentoCard variant="gradient" span={1} className="min-h-[400px]">
          <StockHealthWidget />
        </BentoCard>

        {/* Category Sales Chart - 1 column */}
        <BentoCard variant="glass" span={1} className="min-h-[350px]">
          <CategorySalesChart data={categorySales} />
        </BentoCard>

        {/* Order Status Breakdown - 1 column */}
        <BentoCard variant="elevated" span={1} className="min-h-[350px]">
          <OrderStatusBreakdownWidget />
        </BentoCard>

        {/* Quote Conversion - 1 column */}
        <BentoCard variant="glass" span={1} className="min-h-[350px]">
          <QuoteConversionWidget />
        </BentoCard>

        {/* AI Insights - Spans 2 columns with Border Beam */}
        {insights.length > 0 && (
          <BorderBeam>
            <BentoCard variant="glass" span={2} glowOnHover className="min-h-[350px]">
              <BentoCardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-brand/10 rounded-lg border border-white/10 p-2">
                      <Sparkles className="text-brand-primary h-5 w-5" />
                    </div>
                    <BentoCardTitle className="text-2xl">AI-Powered Insights</BentoCardTitle>
                  </div>
                  <Link href="/insights">
                    <Button variant="outline" size="sm">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <BentoCardDescription>
                  Top priority recommendations from your business data
                </BentoCardDescription>
              </BentoCardHeader>
              <BentoCardContent>
                <div className="space-y-4">
                  {insights.map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </div>
              </BentoCardContent>
            </BentoCard>
          </BorderBeam>
        )}

        {/* PHASE C: AI Sales Insights Widget - Spans 2 columns */}
        <BentoCard variant="elevated" span={2} className="min-h-[400px]">
          <SalesInsightsWidget />
        </BentoCard>

        {/* Transfer Suggestions - 1 column */}
        <BentoCard variant="glass" span={1} className="min-h-[350px]">
          <TransferSuggestionsWidget />
        </BentoCard>

        {/* PHASE 7: Cin7 Sync Status - 1 column */}
        <BentoCard variant="elevated" span={1} className="min-h-[350px]">
          <Cin7SyncStatusWidget />
        </BentoCard>

        {/* NODEJS-Updates: Agent Performance Metrics - 1 column */}
        <BentoCard variant="glass" span={1} className="min-h-[350px]">
          <AgentMetricsWidget />
        </BentoCard>

        {/* PHASE C: AI Order Patterns Widget - Spans 2 columns */}
        <BentoCard variant="glass" span={2} className="min-h-[450px]">
          <OrderPatternsWidget />
        </BentoCard>

        {/* Revenue by Location - Spans 3 columns */}
        <BentoCard variant="glass" span={3} className="min-h-[350px]">
          <RevenueByLocationWidget />
        </BentoCard>

        {/* Top Products - 1 column */}
        <BentoCard variant="elevated" span={1} className="min-h-[350px]">
          <BentoCardHeader>
            <BentoCardTitle>Top 5 Products</BentoCardTitle>
            <BentoCardDescription>By revenue</BentoCardDescription>
          </BentoCardHeader>
          <BentoCardContent>
            <div className="space-y-4">
              {Array.isArray(topProducts) &&
                topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-brand/20 text-brand-primary border-brand-primary/20 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {product.quantity_sold} units sold
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(parseFloat(product.revenue))}
                    </span>
                  </div>
                ))}
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Mobile Photo-to-Order CTA */}
        <BentoCard variant="default" span={1}>
          <BentoCardHeader>
            <div className="flex items-center gap-2">
              <Camera className="text-primary h-5 w-5" />
              <BentoCardTitle>Photo to Order</BentoCardTitle>
            </div>
            <BentoCardDescription>
              Snap a photo, AI identifies products instantly
            </BentoCardDescription>
          </BentoCardHeader>
          <BentoCardContent>
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Tradespeople can photograph cleaning equipment on-site. Our AI recognises it and
                creates a quote for customer approval — no catalogue browsing needed.
              </p>
              <Link href="/settings/mobile">
                <Button size="sm" className="w-full">
                  <Camera className="mr-2 h-4 w-4" />
                  Manage Mobile Orders
                </Button>
              </Link>
            </div>
          </BentoCardContent>
        </BentoCard>

        {/* Recent Activity - Spans 3 columns */}
        <BentoCard variant="glass" span={3}>
          <BentoCardHeader>
            <BentoCardTitle className="text-2xl">Recent Activity</BentoCardTitle>
            <BentoCardDescription>Latest orders and quotes</BentoCardDescription>
          </BentoCardHeader>
          <BentoCardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.isArray(activity) &&
                activity.slice(0, 6).map((item, index) => (
                  <div
                    key={`${item.type}-${index}`}
                    className="bg-card/50 hover:bg-card/80 rounded-lg border border-white/10 p-4 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.title}</span>
                        {item.status && (
                          <span className="bg-secondary rounded-full px-2 py-0.5 text-xs capitalize">
                            {item.status}
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {item.description}
                      </p>
                      <div className="text-muted-foreground text-xs">
                        {format(new Date(item.timestamp), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </BentoCardContent>
        </BentoCard>
      </BentoGrid>
    </div>
  );
}
