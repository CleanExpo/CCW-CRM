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
  FileText,
  Package,
  ShoppingCart,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
import { DashboardAmbient } from '@/components/dashboard/dashboard-ambient';
import { DashboardHero } from '@/components/dashboard/dashboard-hero';
import { DashboardQuickActions } from '@/components/dashboard/dashboard-quick-actions';
import {
  DashboardPresentationToggle,
  DASHBOARD_PRESENTATION_LS_KEY,
} from '@/components/dashboard/dashboard-presentation-toggle';
import {
  DashboardOperationalMix,
  DashboardStatTiles,
  type DashboardStatMetrics,
} from '@/components/dashboard/dashboard-stat-tiles';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { MiniRevenueSparkline } from '@/components/dashboard/MiniRevenueSparkline';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  DASHBOARD_DEMO_AGGREGATED,
  DASHBOARD_DEMO_INSIGHTS,
  DASHBOARD_DEMO_URGENT,
} from '@/lib/dashboard/dashboard-demo-data';

type DashboardMetrics = DashboardStatMetrics;

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

function activityTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t === 'stock') return AlertTriangle;
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
  const [presentationMode, setPresentationMode] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    try {
      setPresentationMode(window.localStorage.getItem(DASHBOARD_PRESENTATION_LS_KEY) === '1');
    } catch {
      /* ignore */
    }
    setBootstrapped(true);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_PRESENTATION_LS_KEY, presentationMode ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [presentationMode]);

  // PHASE 4: Real-time POS failure monitoring (disabled in presentation mode)
  const [posFailureCount, setPosFailureCount] = useState(0);
  const { data: posFailure, status: posAlertStatus } = usePOSFailureAlerts(!presentationMode);

  // PHASE 4: Real-time dashboard metrics
  const { data: metricsUpdate, status: metricsStreamStatus } = useDashboardMetricsStream(
    !presentationMode
  );

  const applyPresentationDemo = useCallback(() => {
    const d = DASHBOARD_DEMO_AGGREGATED;
    setMetrics(d.metrics);
    setRevenueData(d.revenue_chart);
    setCategorySales(d.category_sales);
    setTopProducts(d.top_products);
    setActivity(d.recent_activity);
    setInsights(DASHBOARD_DEMO_INSIGHTS);
    setPosFailureCount(0);
    setUrgentItems(DASHBOARD_DEMO_URGENT as UrgentItem[]);
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;

    let cancelled = false;
    setLoading(true);

    async function loadDashboardData() {
      if (presentationMode) {
        applyPresentationDemo();
        if (!cancelled) setLoading(false);
        return;
      }

      try {
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

        if (cancelled) return;

        setMetrics(dashboardData.metrics);
        setRevenueData(dashboardData.revenue_chart);
        setCategorySales(dashboardData.category_sales);
        setTopProducts(dashboardData.top_products);
        setActivity(dashboardData.recent_activity);
        setInsights(insightsData.insights.filter((i) => i.priority === 'high').slice(0, 3));
        setPosFailureCount(posFailures.alert_count);

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
        setUrgentItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [bootstrapped, presentationMode, applyPresentationDemo]);

  // PHASE 4: Handle real-time POS failure alerts
  useEffect(() => {
    if (presentationMode) return;
    if (posFailure) {
      setPosFailureCount((prev) => prev + 1);
      toast({
        title: 'POS Payment Failed',
        description: `Transaction ${posFailure.transaction_number} at ${posFailure.location_code} failed: ${posFailure.error}`,
        variant: 'destructive',
      });
    }
  }, [posFailure, presentationMode, toast]);

  // PHASE 4: Handle real-time dashboard metrics updates
  useEffect(() => {
    if (presentationMode) return;
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
  }, [metricsUpdate, presentationMode]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(value);
  };

  if (!bootstrapped || loading) {
    return (
      <div className="relative space-y-10 pb-12">
        <DashboardAmbient />
        <div className="space-y-3">
          <Skeleton className="h-10 w-[min(100%,24rem)] max-w-xl bg-white/10" />
          <Skeleton className="h-5 w-full max-w-lg bg-white/10" />
          <Skeleton className="h-4 w-48 bg-white/10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-[5.5rem] rounded-lg bg-white/10" />
          <Skeleton className="h-9 w-[5.75rem] rounded-lg bg-white/10" />
          <Skeleton className="h-9 w-[6rem] rounded-lg bg-white/10" />
          <Skeleton className="h-9 w-[7rem] rounded-lg bg-white/10" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl bg-white/10" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-88 rounded-xl bg-white/10" />
          <Skeleton className="h-88 rounded-xl bg-white/10 md:col-span-1 lg:col-span-2" />
          <Skeleton className="h-88 rounded-xl bg-white/10" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64 rounded-xl bg-white/10" />
          <Skeleton className="h-64 rounded-xl bg-white/10" />
          <Skeleton className="h-64 rounded-xl bg-white/10" />
        </div>
      </div>
    );
  }

  const todayLabel = format(new Date(), 'EEEE, d MMMM yyyy');

  return (
    <div className="relative space-y-12 pb-12">
      <DashboardAmbient />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <DashboardHero
          eyebrow={todayLabel}
          title={
            <>
              Operations hub for{' '}
              <span className="text-transparent bg-gradient-to-r from-sky-200 via-white to-indigo-200 bg-clip-text">
                equipment suppliers
              </span>
            </>
          }
          description="Real-time trading, inventory signals, and pipeline health — aligned with your CCW Online brand experience."
          aside={
            <div className="flex flex-col gap-4">
              <DashboardPresentationToggle
                checked={presentationMode}
                onCheckedChange={setPresentationMode}
              />
              {!presentationMode && posFailureCount > 0 ? (
                <Link href="/pos/reconciliation" className="block shrink-0">
                  <Card className="overflow-hidden rounded-2xl border border-red-500/35 bg-gradient-to-br from-red-950/40 via-zinc-950/80 to-black shadow-lg shadow-red-900/20 ring-1 ring-red-500/15 transition-colors hover:border-red-400/40">
                    <CardContent className="px-4 py-4 sm:px-5">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="text-destructive h-5 w-5 shrink-0" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-destructive text-sm font-medium">
                            {posFailureCount} POS {posFailureCount === 1 ? 'failure' : 'failures'}
                          </p>
                          <p className="text-xs text-zinc-400">Last 24 hours · Review reconciliation</p>
                        </div>
                        {posAlertStatus === 'connected' ? (
                          <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                            Live
                          </Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ) : null}
            </div>
          }
        />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <DashboardQuickActions />
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {presentationMode ? (
              <Badge
                variant="outline"
                className="border-amber-400/35 bg-amber-500/10 text-xs font-medium text-amber-100"
              >
                Sample data
              </Badge>
            ) : null}
            {!presentationMode && metricsStreamStatus === 'connected' ? (
              <Badge variant="outline" className="border-white/15 text-xs font-normal text-zinc-200">
                <span
                  className="mr-2 inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500"
                  aria-hidden
                />
                Live metrics
              </Badge>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* Urgent Today Card */}
      {urgentItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-zinc-950/90 to-black shadow-xl shadow-amber-900/10 ring-1 ring-amber-500/15">
            <CardHeader className="space-y-1 pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                <CardTitle className="text-base font-semibold text-amber-100">
                  Needs attention today
                </CardTitle>
              </div>
              <p className="text-sm text-amber-200/80">
                {urgentItems.length} item{urgentItems.length !== 1 ? 's' : ''} · tap to open
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {urgentItems.map((item, idx) => (
                  <Link key={idx} href={item.href}>
                    <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-950/30 p-3.5 transition-colors hover:border-amber-400/35 hover:bg-amber-950/45">
                      <span className="mt-0.5 shrink-0">
                        {item.type === 'warranty' && <Wrench className="h-4 w-4 text-amber-400" />}
                        {item.type === 'certification' && (
                          <Award className="h-4 w-4 text-amber-400" />
                        )}
                        {item.type === 'stock' && <Package className="h-4 w-4 text-amber-400" />}
                        {item.type === 'invoice' && <Clock className="h-4 w-4 text-amber-400" />}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-amber-50">{item.label}</p>
                        <p className="truncate text-xs text-amber-200/80">{item.detail}</p>
                        {item.daysLeft !== undefined && (
                          <Badge
                            variant="outline"
                            className="mt-1 border-amber-500/40 text-xs text-amber-200"
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
          <BentoCard
            variant="glass"
            span={3}
            className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/85 via-zinc-950/90 to-black shadow-[0_28px_90px_-40px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06]"
          >
            <BentoCardHeader className="space-y-1">
              <BentoCardTitle className="text-xl text-zinc-50 sm:text-2xl">
                Business performance
              </BentoCardTitle>
              <BentoCardDescription className="text-zinc-400">
                Real-time trading metrics across all locations
              </BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <DashboardStatTiles metrics={metrics} formatCurrency={formatCurrency} />

              <div className="border-border/40 mt-8 space-y-8 border-t border-white/[0.06] pt-6">
                <DashboardOperationalMix metrics={metrics} />
                <MiniRevenueSparkline data={revenueData} />
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
          <BentoCard
            variant="glass"
            span={2}
            className="min-h-[400px] overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/80 to-black/90 ring-1 ring-white/[0.05]"
          >
            <RevenueChart data={revenueData} />
          </BentoCard>

          <BentoCard variant="gradient" span={1} className="min-h-[400px] overflow-hidden rounded-2xl shadow-lg">
            <StockHealthWidget />
          </BentoCard>

          <BentoCard
            variant="glass"
            span={1}
            className="min-h-[350px] overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-950/90 via-black/80 to-zinc-900/60 ring-1 ring-white/[0.05]"
          >
            <CategorySalesChart data={categorySales} />
          </BentoCard>

          <BentoCard
            variant="elevated"
            span={1}
            className="min-h-[350px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 shadow-xl ring-1 ring-white/[0.04]"
          >
            <OrderStatusBreakdownWidget />
          </BentoCard>

          <BentoCard
            variant="glass"
            span={1}
            className="min-h-[350px] overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-indigo-950/40 via-zinc-950/90 to-black ring-1 ring-indigo-500/10"
          >
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
                        <BentoCardTitle className="text-xl text-zinc-50 sm:text-2xl">
                          AI-powered insights
                        </BentoCardTitle>
                        <BentoCardDescription className="text-zinc-400">
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
          <BentoCard
            variant="glass"
            span={3}
            className="min-h-[350px] overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-zinc-900/85 via-zinc-950/95 to-black ring-1 ring-white/[0.05]"
          >
            <RevenueByLocationWidget />
          </BentoCard>
        </BentoGrid>
      </DashboardSection>

      <DashboardSection
        id="section-products"
        title="Products & mobile tools"
        description="Top lines ranked by delivered revenue allocated using catalogue mix (until order line items exist)."
      >
        <BentoGrid columns={3} gap="lg">
          <BentoCard
            variant="elevated"
            span={1}
            className="min-h-[350px] overflow-hidden rounded-2xl border border-sky-500/15 bg-gradient-to-b from-sky-500/5 via-zinc-950/90 to-black shadow-xl ring-1 ring-sky-500/10"
          >
            <BentoCardHeader>
              <BentoCardTitle className="text-zinc-50">Top 5 products</BentoCardTitle>
              <BentoCardDescription className="text-zinc-400">
                {presentationMode
                  ? 'Demo best-sellers by revenue'
                  : 'Allocated from delivered orders × inventory mix'}
              </BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <ul className="divide-border/60 divide-y">
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
                          <p className="text-sm leading-snug font-medium text-zinc-100">
                            {product.name}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {presentationMode
                              ? `${product.quantity_sold} units sold`
                              : 'Share-weighted rank · not line-level units'}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-zinc-100 tabular-nums">
                        {formatCurrency(parseFloat(product.revenue))}
                      </span>
                    </li>
                  ))}
              </ul>
            </BentoCardContent>
          </BentoCard>

          <BentoCard
            variant="default"
            span={1}
            className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-black shadow-lg ring-1 ring-white/[0.05]"
          >
            <BentoCardHeader>
              <div className="flex items-center gap-2">
                <Camera className="text-primary h-5 w-5 shrink-0" aria-hidden />
                <BentoCardTitle className="text-zinc-50">Photo to order</BentoCardTitle>
              </div>
              <BentoCardDescription className="text-zinc-400">
                Snap a photo, AI identifies products instantly
              </BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-zinc-400">
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
          <BentoCard
            variant="glass"
            span={3}
            className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-zinc-950/90 via-black/85 to-zinc-900/50 ring-1 ring-white/[0.06]"
          >
            <BentoCardHeader className="space-y-1">
              <BentoCardTitle className="text-xl text-zinc-50 sm:text-2xl">
                Activity feed
              </BentoCardTitle>
              <BentoCardDescription className="text-zinc-400">
                Equipment orders and quotes
              </BentoCardDescription>
            </BentoCardHeader>
            <BentoCardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Array.isArray(activity) &&
                  activity.slice(0, 6).map((item, index) => {
                    const Icon = activityTypeIcon(item.type);
                    return (
                      <div
                        key={`${item.type}-${index}`}
                        className="flex gap-3 rounded-xl border border-white/[0.08] bg-gradient-to-br from-zinc-900/70 to-zinc-950/80 p-4 shadow-sm ring-1 ring-white/[0.04] transition-colors hover:border-sky-500/20 hover:from-zinc-900/90 hover:to-black"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-800/90 text-zinc-300">
                          <Icon className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm leading-snug font-medium text-zinc-100">
                              {item.title}
                            </span>
                            {item.status ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-normal capitalize"
                              >
                                {item.status}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-400">
                            {item.description}
                          </p>
                          <time
                            className="block text-xs text-zinc-400 tabular-nums"
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
