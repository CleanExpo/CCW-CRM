'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
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
} from 'lucide-react';
import { InsightCard } from '@/components/insights/insight-card';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { CategorySalesChart } from '@/components/charts/CategorySalesChart';
import { StockHealthWidget } from '@/components/dashboard/StockHealthWidget';
import { TransferSuggestionsWidget } from '@/components/dashboard/TransferSuggestionsWidget';
import { OrderStatusBreakdownWidget } from '@/components/dashboard/OrderStatusBreakdownWidget';
import { QuoteConversionWidget } from '@/components/dashboard/QuoteConversionWidget';
import { RevenueByLocationWidget } from '@/components/dashboard/RevenueByLocationWidget';
import { SalesInsightsWidget } from '@/components/dashboard/SalesInsightsWidget';
import { OrderPatternsWidget } from '@/components/dashboard/OrderPatternsWidget';
import { Cin7SyncStatusWidget } from '@/components/dashboard/Cin7SyncStatusWidget';
import { AgentMetricsWidget } from '@/components/dashboard/AgentMetricsWidget';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { useDashboardData } from '@/lib/hooks/use-dashboard-data';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);

export default function DashboardPage() {
  const {
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
  } = useDashboardData();

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
          {metricsStreamStatus === 'connected' && (
            <Badge variant="outline" className="text-xs">
              <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Live Metrics
            </Badge>
          )}
        </div>

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
        {/* Metrics Overview */}
        <BentoCard variant="glass" span={3}>
          <BentoCardHeader>
            <BentoCardTitle className="text-2xl">Key Metrics</BentoCardTitle>
            <BentoCardDescription>Real-time business performance indicators</BentoCardDescription>
          </BentoCardHeader>
          <BentoCardContent>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
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
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="text-sm font-medium">Active Orders</span>
                </div>
                <div className="text-3xl font-bold">{metrics?.active_orders || 0}</div>
                <p className="text-muted-foreground text-xs">In progress</p>
              </div>
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="text-sm font-medium">Total Products</span>
                </div>
                <div className="text-3xl font-bold">{metrics?.total_products || 0}</div>
                <p className="text-muted-foreground text-xs">Active catalog items</p>
              </div>
              <div className="space-y-2">
                <div className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">Total Customers</span>
                </div>
                <div className="text-3xl font-bold">{metrics?.total_customers || 0}</div>
                <p className="text-muted-foreground text-xs">Active customers</p>
              </div>
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

        <BentoCard variant="glass" span={3} className="min-h-[350px]">
          <RevenueByLocationWidget />
        </BentoCard>

        {/* Top Products */}
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

        {/* Recent Activity */}
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
