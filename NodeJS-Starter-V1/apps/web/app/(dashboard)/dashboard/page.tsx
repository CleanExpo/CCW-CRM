"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ShoppingCart, Package, Users, AlertTriangle, FileText, Sparkles, ArrowRight, TrendingUp, TrendingDown, Medal } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getDashboardInsights, type Insight } from "@/lib/api/ai-insights";
import { InsightCard } from "@/components/insights/insight-card";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { CategorySalesChart } from "@/components/charts/CategorySalesChart";
import { StaggerChildren, StaggerItem } from "@/components/transitions/StaggerChildren";
import { FadeIn } from "@/components/transitions/FadeIn";
import { StockHealthWidget } from "@/components/dashboard/StockHealthWidget";
import { TransferSuggestionsWidget } from "@/components/dashboard/TransferSuggestionsWidget";
import { OrderStatusBreakdownWidget } from "@/components/dashboard/OrderStatusBreakdownWidget";
import { QuoteConversionWidget } from "@/components/dashboard/QuoteConversionWidget";
import { RevenueByLocationWidget } from "@/components/dashboard/RevenueByLocationWidget";
import { format } from "date-fns";
import { useRealTimeOrders } from "@/hooks/use-real-time-orders";
import { useRealTimeInventory } from "@/hooks/use-real-time-inventory";

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

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      const [metricsData, revenueData, categoryData, topProductsData, activityData, insightsData] = await Promise.all([
        apiClient.get<DashboardMetrics>("/api/dashboard/metrics"),
        apiClient.get<RevenueDataPoint[]>("/api/dashboard/charts/revenue"),
        apiClient.get<CategorySales[]>("/api/dashboard/charts/categories"),
        apiClient.get<TopProduct[]>("/api/dashboard/charts/top-products"),
        apiClient.get<ActivityItem[]>("/api/dashboard/activity"),
        getDashboardInsights(3).catch(() => ({ insights: [], total: 0, categories: [] })),
      ]);

      setMetrics(metricsData);
      setRevenueData(revenueData);
      setCategorySales(categoryData);
      setTopProducts(topProductsData);
      setActivity(activityData);
      setInsights(insightsData.insights.filter((i) => i.priority === "high").slice(0, 3));
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      // Set empty defaults on error to prevent rendering issues
      setMetrics(null);
      setRevenueData([]);
      setCategorySales([]);
      setTopProducts([]);
      setActivity([]);
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Enable real-time updates via WebSocket
  useRealTimeOrders({
    showNotifications: false, // Don't show notifications on dashboard (too noisy)
    onOrderCreated: loadDashboardData,
    onOrderUpdated: loadDashboardData,
    onOrderDeleted: loadDashboardData,
    onOrderStatusChanged: loadDashboardData,
  });

  useRealTimeInventory({
    showNotifications: false, // Don't show notifications on dashboard
    onInventoryUpdate: loadDashboardData,
  });

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Equipment Supplier ERP - Overview</p>
      </div>

      {/* Metrics Cards - Enhanced with Trend Indicators */}
      <StaggerChildren className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <div className="rounded-full bg-brand-primary-100 p-2 dark:bg-brand-primary-950">
                <DollarSign className="h-4 w-4 text-brand-primary-600 dark:text-brand-primary-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(parseFloat(metrics?.total_revenue_this_month || "0"))}</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-success" />
                <span className="text-xs font-medium text-success">+12.5%</span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <div className="rounded-full bg-info-muted p-2">
                <ShoppingCart className="h-4 w-4 text-info" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.active_orders || 0}</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-success" />
                <span className="text-xs font-medium text-success">+8.2%</span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <div className="rounded-full bg-brand-accent-100 p-2 dark:bg-brand-accent-950">
                <Package className="h-4 w-4 text-brand-accent-600 dark:text-brand-accent-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.total_products || 0}</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-success" />
                <span className="text-xs font-medium text-success">+3.1%</span>
                <span className="text-xs text-muted-foreground">new this month</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <div className="rounded-full bg-brand-secondary-100 p-2 dark:bg-brand-secondary-950">
                <Users className="h-4 w-4 text-brand-secondary-600 dark:text-brand-secondary-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.total_customers || 0}</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-success" />
                <span className="text-xs font-medium text-success">+5.4%</span>
                <span className="text-xs text-muted-foreground">new this month</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
              <div className="rounded-full bg-error-muted p-2">
                <AlertTriangle className="h-4 w-4 text-error" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-error">{metrics?.low_stock_alerts || 0}</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingDown className="h-3 w-3 text-success" />
                <span className="text-xs font-medium text-success">-15.2%</span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card variant="elevated">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Quotes</CardTitle>
              <div className="rounded-full bg-warning-muted p-2">
                <FileText className="h-4 w-4 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.pending_quotes || 0}</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-warning" />
                <span className="text-xs font-medium text-warning">+2 new</span>
                <span className="text-xs text-muted-foreground">today</span>
              </div>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerChildren>

      {/* AI Insights Widget - Enhanced with Gradient & Glow */}
      {insights.length > 0 && (
        <FadeIn delay={0.4}>
          <Card
            variant="featured"
            className="relative overflow-hidden border-brand-primary/30 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/10 shadow-lg hover:shadow-xl transition-shadow duration-normal"
          >
            {/* Glowing border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/10 via-brand-secondary/10 to-brand-primary/10 opacity-50 blur-xl" aria-hidden="true" />

            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-brand-primary-100 p-2.5 dark:bg-brand-primary-900/50">
                    <Sparkles className="h-5 w-5 text-brand-primary-600 dark:text-brand-primary-400 animate-pulse-soft" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AI-Powered Insights</CardTitle>
                    <CardDescription className="mt-0.5">
                      Top priority recommendations from your business data
                    </CardDescription>
                  </div>
                </div>
                <Link href="/insights">
                  <Button variant="outline" size="sm" className="border-brand-primary/30 hover:bg-brand-primary/10">
                    View All
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                {insights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Data Visualizations */}
      <FadeIn delay={0.5}>
        <div className="grid gap-4 md:grid-cols-2">
          <RevenueChart data={revenueData} />
          <CategorySalesChart data={categorySales} />
        </div>
      </FadeIn>

      {/* Inventory Management Widgets */}
      <FadeIn delay={0.6}>
        <div className="grid gap-4 lg:grid-cols-2">
          <StockHealthWidget />
          <TransferSuggestionsWidget />
        </div>
      </FadeIn>

      {/* Analytics Widgets */}
      <FadeIn delay={0.65}>
        <div className="grid gap-4 lg:grid-cols-3">
          <OrderStatusBreakdownWidget />
          <QuoteConversionWidget />
          <RevenueByLocationWidget />
        </div>
      </FadeIn>

      {/* Top Products - Enhanced with Medal Icons */}
      <FadeIn delay={0.7}>
        <Card variant="elevated">
        <CardHeader>
          <CardTitle>Top 5 Products</CardTitle>
          <CardDescription>By revenue - highest performers this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.isArray(topProducts) && topProducts.map((product, index) => {
              const getMedalColor = () => {
                if (index === 0) return "text-yellow-500";
                if (index === 1) return "text-slate-400";
                if (index === 2) return "text-orange-600";
                return "";
              };

              return (
                <div
                  key={product.name}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors duration-fast"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {index < 3 ? (
                      <div className="flex h-10 w-10 items-center justify-center">
                        <Medal className={`h-7 w-7 ${getMedalColor()}`} />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                        {index + 1}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.quantity_sold} units sold</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-brand-primary-700 dark:text-brand-primary-400 ml-4">
                    {formatCurrency(parseFloat(product.revenue))}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </FadeIn>

      {/* Recent Activity */}
      <FadeIn delay={0.8}>
        <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest orders and quotes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.isArray(activity) && activity.map((item, index) => (
              <div key={`${item.type}-${index}`} className="flex items-start justify-between border-b pb-3 last:border-0">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {item.title}
                    </span>
                    {item.status && (
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary capitalize">
                        {item.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {format(new Date(item.timestamp), "MMM dd, yyyy")}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </FadeIn>
    </div>
  );
}
