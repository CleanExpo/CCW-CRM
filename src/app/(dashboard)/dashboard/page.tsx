'use client';

import {
  BentoCard,
  BentoCardContent,
  BentoCardDescription,
  BentoCardHeader,
  BentoCardTitle,
  BentoGrid,
} from '@/components/ui/bento-grid';
import { BorderBeam } from '@/components/ui/border-beam';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardInsights, type Insight } from '@/lib/api/ai-insights';
import { apiClient } from '@/lib/api/client';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Camera,
  Clock,
  DollarSign,
  FileText,
  Package,
  ShoppingCart,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
// PHASE 4: Real-time POS failure alerts + Dashboard metrics
import { CategorySalesChart } from '@/components/charts/CategorySalesChart';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { OrderStatusBreakdownWidget } from '@/components/dashboard/OrderStatusBreakdownWidget';
import { QuoteConversionWidget } from '@/components/dashboard/QuoteConversionWidget';
import { RevenueByLocationWidget } from '@/components/dashboard/RevenueByLocationWidget';
import { StockHealthWidget } from '@/components/dashboard/StockHealthWidget';
import { TransferSuggestionsWidget } from '@/components/dashboard/TransferSuggestionsWidget';
import { InsightCard } from '@/components/insights/insight-card';
import { Badge } from '@/components/ui/badge';
import { useDashboardMetricsStream, usePOSFailureAlerts } from '@/hooks/use-sse';
import { useToast } from '@/hooks/use-toast';
// PHASE C: AI Sales Insights Widget
import { SalesInsightsWidget } from '@/components/dashboard/SalesInsightsWidget';
// PHASE C: AI Order Patterns Widget
import { OrderPatternsWidget } from '@/components/dashboard/OrderPatternsWidget';
// PHASE 7: Cin7 Sync Status Widget
import { Cin7SyncStatusWidget } from '@/components/dashboard/Cin7SyncStatusWidget';
// NODEJS-Updates: Agent performance metrics widget
import { AgentMetricsWidget } from '@/components/dashboard/AgentMetricsWidget';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { Skeleton } from '@/components/ui/skeleton';
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

interface UrgentItem {
  type: 'warranty' | 'certification' | 'invoice' | 'stock';
  label: string;
  detail: string;
  daysLeft?: number;
  href: string;
}

interface WarrantyAlert {
  serial_number: string;
  product_name: string | null;
  company_name: string | null;
  days_until_expiry: number;
}

interface CertAlert {
  cert_type: string;
  technician_name: string | null;
  company_name: string | null;
  days_until_expiry: number;
}

interface EquipmentStats {
  expiring_soon: number;
  warranty_alerts: WarrantyAlert[];
}

interface CertStats {
  expiring_soon: number;
  expiring_alerts: CertAlert[];
}

const statShell =
  'flex flex-col gap-2 rounded-xl border border-border/50 bg-muted/10 p-4 transition-colors hover:bg-muted/20 sm:min-h-[7.5rem] sm:p-5';
const statShellDanger =
  'flex flex-col gap-2 rounded-xl border border-destructive/20 bg-destructive/[0.04] p-4 transition-colors hover:bg-destructive/[0.06] sm:min-h-[7.5rem] sm:p-5';

function activityTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('order')) return ShoppingCart;
  if (t.includes('quote')) return FileText;
  if (t.includes('customer') || t.includes('contact')) return Users;
  return Package;
}

export default function DashboardPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [urgentItems, setUrgentItems] = useState<UrgentItem[]>([]);
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
        const [dashboardData, insightsData, posFailures, warrantyStats, certStats] =
          await Promise.all([
            apiClient.get<AggregatedDashboardData>('/api/dashboard/aggregated'),
            getDashboardInsights(3).catch(() => ({ insights: [], total: 0, categories: [] })),
            apiClient
              .get<{ alert_count: number }>('/api/monitoring/alerts/pos-failures?hours=24')
              .catch(() => ({ alert_count: 0 })),
            apiClient
              .get<EquipmentStats>('/api/equipment/stats')
              .catch(() => ({ expiring_soon: 0, warranty_alerts: [] })),
            apiClient
              .get<CertStats>('/api/certifications/stats')
              .catch(() => ({ expiring_soon: 0, expiring_alerts: [] })),
          ]);

        // Destructure aggregated data
        setMetrics(dashboardData.metrics);
        setRevenueData(dashboardData.revenue_chart);
        setCategorySales(dashboardData.category_sales);
        setTopProducts(dashboardData.top_products);
        setActivity(dashboardData.recent_activity);
        setInsights(insightsData.insights.filter((i) => i.priority === 'high').slice(0, 3));
        setPosFailureCount(posFailures.alert_count);

        // Build urgent items list
        const urgent: UrgentItem[] = [];
        (warrantyStats.warranty_alerts || []).slice(0, 3).forEach((w) => {
          urgent.push({
            type: 'warranty',
            label: `Warranty expiring: ${w.product_name || w.serial_number}`,
            detail: w.company_name ? `Customer: ${w.company_name}` : w.serial_number,
            daysLeft: w.days_until_expiry,
            href: '/warehouse/equipment',
          });
        });
        (certStats.expiring_alerts || []).slice(0, 3).forEach((c) => {
          urgent.push({
            type: 'certification',
            label: `${c.cert_type} expiring`,
            detail: c.technician_name || c.company_name || 'Unknown technician',
            daysLeft: c.days_until_expiry,
            href: '/customers',
          });
        });
        if (dashboardData.metrics.low_stock_alerts > 0) {
          urgent.push({
            type: 'stock',
            label: `${dashboardData.metrics.low_stock_alerts} products below reorder point`,
            detail: 'Review inventory levels',
            href: '/warehouse',
          });
        }
        setUrgentItems(urgent);
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
      <div className="space-y-10 pb-12">
        <div className="space-y-3">
          <Skeleton className="h-10 w-[min(100%,24rem)] max-w-xl" />
          <Skeleton className="h-5 w-full max-w-lg" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-88 rounded-xl" />
          <Skeleton className="h-88 rounded-xl md:col-span-1 lg:col-span-2" />
          <Skeleton className="h-88 rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy');

  return (
    <div className="space-y-12 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between"
      >
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {todayLabel}
            </p>
            {metricsStreamStatus === 'connected' && (
              <Badge variant="outline" className="text-xs font-normal">
                <span
                  className="mr-2 inline-flex h-2 w-2 animate-pulse rounded-full bg-green-500"
                  aria-hidden
                />
                Live metrics
              </Badge>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              CCW Online — Cleaning Equipment Operations
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Real-time overview — truckmounts, restoration gear, hard floor care &amp; accessories
            </p>
          </div>
        </div>

        {posFailureCount > 0 && (
          <Link href="/pos/reconciliation" className="shrink-0">
            <Card className="border-destructive/40 bg-destructive/5 transition-colors hover:bg-destructive/10">
              <CardContent className="px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-destructive">
                      {posFailureCount} POS {posFailureCount === 1 ? 'failure' : 'failures'}
                    </p>
                    <p className="text-muted-foreground text-xs">Last 24 hours · Review reconciliation</p>
                  </div>
                  {posAlertStatus === 'connected' && (
                    <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                      Live
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </motion.div>

      {/* Urgent Today Card */}
      {urgentItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="border-amber-200/80 bg-amber-50/50 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/25">
            <CardHeader className="space-y-1 pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                <CardTitle className="text-base font-semibold text-amber-950 dark:text-amber-50">
                  Needs attention today
                </CardTitle>
              </div>
              <p className="text-sm text-amber-900/80 dark:text-amber-200/90">
                {urgentItems.length} item{urgentItems.length !== 1 ? 's' : ''} · tap to open
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {urgentItems.map((item, idx) => (
                  <Link key={idx} href={item.href}>
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200/90 bg-white/80 p-3.5 transition-colors hover:border-amber-300 hover:bg-white dark:border-amber-700/80 dark:bg-amber-950/40 dark:hover:bg-amber-950/55">
                      <span className="mt-0.5 shrink-0">
                        {item.type === 'warranty' && <Wrench className="h-4 w-4 text-amber-600" />}
                        {item.type === 'certification' && (
                          <Award className="h-4 w-4 text-amber-600" />
                        )}
                        {item.type === 'stock' && <Package className="h-4 w-4 text-amber-600" />}
                        {item.type === 'invoice' && <Clock className="h-4 w-4 text-amber-600" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-amber-900 dark:text-amber-100">
                          {item.label}
                        </p>
                        <p className="truncate text-xs text-amber-700 dark:text-amber-300">
                          {item.detail}
                        </p>
                        {item.daysLeft !== undefined && (
                          <Badge
                            variant="outline"
                            className="mt-1 border-amber-300 text-xs text-amber-700"
                          >
                            {item.daysLeft <= 0 ? 'Expired' : `${item.daysLeft}d remaining`}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <DashboardSection
        id="section-performance"
        title="Performance overview"
        description="Headline trading numbers for the current month — use these before drilling into charts."
      >
        <BentoGrid columns={3} gap="lg">
          <BentoCard variant="glass" span={3}>
            <BentoCardHeader className="space-y-1">
              <BentoCardTitle className="text-xl sm:text-2xl">Business performance</BentoCardTitle>
              <BentoCardDescription>
                Real-time trading metrics across all locations
              </BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className={statShell}>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-xs font-medium uppercase tracking-wide">Total revenue</span>
                  </div>
                  <div className="text-brand-primary text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                    {formatCurrency(parseFloat(metrics?.total_revenue_this_month || '0'))}
                  </div>
                  <p className="text-muted-foreground mt-auto text-xs leading-snug">
                    This month from delivered orders
                  </p>
                </div>

                <div className={statShell}>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-xs font-medium uppercase tracking-wide">Active orders</span>
                  </div>
                  <div className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                    {metrics?.active_orders || 0}
                  </div>
                  <p className="text-muted-foreground mt-auto text-xs leading-snug">In progress</p>
                </div>

                <div className={statShell}>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Package className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-xs font-medium uppercase tracking-wide">Equipment SKUs</span>
                  </div>
                  <div className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                    {metrics?.total_products || 0}
                  </div>
                  <p className="text-muted-foreground mt-auto text-xs leading-snug">
                    Active cleaning equipment lines
                  </p>
                </div>

                <div className={statShell}>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-xs font-medium uppercase tracking-wide">Customers</span>
                  </div>
                  <div className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                    {metrics?.total_customers || 0}
                  </div>
                  <p className="text-muted-foreground mt-auto text-xs leading-snug">Active customers</p>
                </div>

                <div className={statShellDanger}>
                  <div className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="text-xs font-medium uppercase tracking-wide">Low stock</span>
                  </div>
                  <div className="text-destructive text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                    {metrics?.low_stock_alerts || 0}
                  </div>
                  <p className="text-muted-foreground mt-auto text-xs leading-snug">
                    Items with stock ≤ 10
                  </p>
                </div>

                <div className={statShell}>
                  <div className="text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-xs font-medium uppercase tracking-wide">Pending quotes</span>
                  </div>
                  <div className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                    {metrics?.pending_quotes || 0}
                  </div>
                  <p className="text-muted-foreground mt-auto text-xs leading-snug">Awaiting response</p>
                </div>
              </div>
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </DashboardSection>

      <DashboardSection
        id="section-revenue"
        title="Revenue & pipeline"
        description="Trends, categories, and funnel health — pair with stock alerts on the right."
      >
        <BentoGrid columns={3} gap="lg">
          <BentoCard variant="glass" span={2} className="min-h-[400px]">
            <RevenueChart data={revenueData} />
          </BentoCard>

          <BentoCard variant="gradient" span={1} className="min-h-[400px]">
            <StockHealthWidget />
          </BentoCard>

          <BentoCard variant="glass" span={1} className="min-h-[350px]">
            <CategorySalesChart data={categorySales} />
          </BentoCard>

          <BentoCard variant="elevated" span={1} className="min-h-[350px]">
            <OrderStatusBreakdownWidget />
          </BentoCard>

          <BentoCard variant="glass" span={1} className="min-h-[350px]">
            <QuoteConversionWidget />
          </BentoCard>
        </BentoGrid>
      </DashboardSection>

      <DashboardSection
        id="section-insights"
        title="Insights & automation"
        description="AI highlights, sales signals, transfers, integrations, and agent activity."
      >
        <BentoGrid columns={3} gap="lg">
          {insights.length > 0 && (
            <BorderBeam>
              <BentoCard variant="glass" span={2} glowOnHover className="min-h-[350px]">
                <BentoCardHeader>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-brand/10 rounded-lg border border-white/10 p-2">
                        <Sparkles className="text-brand-primary h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <BentoCardTitle className="text-xl sm:text-2xl">AI-powered insights</BentoCardTitle>
                        <BentoCardDescription>
                          Top priority recommendations from your business data
                        </BentoCardDescription>
                      </div>
                    </div>
                    <Link href="/insights" className="shrink-0">
                      <Button variant="outline" size="sm">
                        View all
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
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

          <BentoCard variant="elevated" span={2} className="min-h-[400px]">
            <SalesInsightsWidget />
          </BentoCard>

          <BentoCard variant="glass" span={1} className="min-h-[350px]">
            <TransferSuggestionsWidget />
          </BentoCard>

          <BentoCard variant="elevated" span={1} className="min-h-[350px]">
            <Cin7SyncStatusWidget />
          </BentoCard>

          <BentoCard variant="glass" span={1} className="min-h-[350px]">
            <AgentMetricsWidget />
          </BentoCard>

          <BentoCard variant="glass" span={2} className="min-h-[450px]">
            <OrderPatternsWidget />
          </BentoCard>
        </BentoGrid>
      </DashboardSection>

      <DashboardSection
        id="section-regional"
        title="Regional performance"
        description="Revenue contribution by location for planning and stock placement."
      >
        <BentoGrid columns={3} gap="lg">
          <BentoCard variant="glass" span={3} className="min-h-[350px]">
            <RevenueByLocationWidget />
          </BentoCard>
        </BentoGrid>
      </DashboardSection>

      <DashboardSection
        id="section-products"
        title="Products & mobile tools"
        description="Best sellers by revenue and the photo-to-order workflow for field teams."
      >
        <BentoGrid columns={3} gap="lg">
          <BentoCard variant="elevated" span={1} className="min-h-[350px]">
            <BentoCardHeader>
              <BentoCardTitle>Top 5 products</BentoCardTitle>
              <BentoCardDescription>Ranked by revenue</BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <ul className="divide-y divide-border/60">
                {Array.isArray(topProducts) &&
                  topProducts.map((product, index) => (
                    <li
                      key={product.name}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="bg-gradient-brand/20 text-brand-primary border-brand-primary/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">{product.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {product.quantity_sold} units sold
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCurrency(parseFloat(product.revenue))}
                      </span>
                    </li>
                  ))}
              </ul>
            </BentoCardContent>
          </BentoCard>

          <BentoCard variant="default" span={1}>
            <BentoCardHeader>
              <div className="flex items-center gap-2">
                <Camera className="text-primary h-5 w-5 shrink-0" aria-hidden />
                <BentoCardTitle>Photo to order</BentoCardTitle>
              </div>
              <BentoCardDescription>
                Snap a photo, AI identifies products instantly
              </BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Tradespeople can photograph cleaning equipment on-site. Our AI recognises it and
                  creates a quote for customer approval — no catalogue browsing needed.
                </p>
                <Link href="/settings/mobile">
                  <Button size="sm" className="w-full">
                    <Camera className="mr-2 h-4 w-4" />
                    Manage mobile orders
                  </Button>
                </Link>
              </div>
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </DashboardSection>

      <DashboardSection
        id="section-activity"
        title="Latest activity"
        description="Recent orders and quotes — skim the last six events at a glance."
      >
        <BentoGrid columns={3} gap="lg">
          <BentoCard variant="glass" span={3}>
            <BentoCardHeader className="space-y-1">
              <BentoCardTitle className="text-xl sm:text-2xl">Activity feed</BentoCardTitle>
              <BentoCardDescription>Equipment orders and quotes</BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Array.isArray(activity) &&
                  activity.slice(0, 6).map((item, index) => {
                    const Icon = activityTypeIcon(item.type);
                    return (
                      <div
                        key={`${item.type}-${index}`}
                        className="bg-card/40 hover:bg-card/70 flex gap-3 rounded-xl border border-border/50 p-4 transition-colors"
                      >
                        <div className="bg-muted/50 text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                          <Icon className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium leading-snug">{item.title}</span>
                            {item.status ? (
                              <Badge variant="secondary" className="text-[10px] font-normal capitalize">
                                {item.status}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                            {item.description}
                          </p>
                          <time
                            className="text-muted-foreground block text-xs tabular-nums"
                            dateTime={item.timestamp}
                          >
                            {format(new Date(item.timestamp), 'MMM d, yyyy')}
                          </time>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </BentoCardContent>
          </BentoCard>
        </BentoGrid>
      </DashboardSection>
    </div>
  );
}
