"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, ShoppingCart, Package, Users, AlertTriangle, FileText, Sparkles, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getDashboardInsights, type Insight } from "@/lib/api/ai-insights";
import { InsightCard } from "@/components/insights/insight-card";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { CategorySalesChart } from "@/components/charts/CategorySalesChart";
import { StaggerChildren, StaggerItem } from "@/components/transitions/StaggerChildren";
import { FadeIn } from "@/components/transitions/FadeIn";

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

  useEffect(() => {
    async function loadDashboardData() {
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
    }

    loadDashboardData();
  }, []);

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

      {/* Metrics Cards */}
      <StaggerChildren className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <Card className="card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(parseFloat(metrics?.total_revenue_this_month || "0"))}</div>
              <p className="text-xs text-muted-foreground">This month from delivered orders</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.active_orders || 0}</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.total_products || 0}</div>
              <p className="text-xs text-muted-foreground">Active catalog items</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.total_customers || 0}</div>
              <p className="text-xs text-muted-foreground">Active customers</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{metrics?.low_stock_alerts || 0}</div>
              <p className="text-xs text-muted-foreground">Items with stock ≤ 10</p>
            </CardContent>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="card-interactive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Quotes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.pending_quotes || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting response</p>
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerChildren>

      {/* AI Insights Widget */}
      {insights.length > 0 && (
        <FadeIn delay={0.4}>
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>AI-Powered Insights</CardTitle>
              </div>
              <Link href="/insights">
                <Button variant="outline" size="sm">
                  View All
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
            <CardDescription>
              Top priority recommendations from your business data
            </CardDescription>
          </CardHeader>
          <CardContent>
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

      {/* Top Products */}
      <FadeIn delay={0.6}>
        <Card>
        <CardHeader>
          <CardTitle>Top 5 Products</CardTitle>
          <CardDescription>By revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.isArray(topProducts) && topProducts.map((product, index) => (
              <div key={product.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.quantity_sold} units sold</p>
                  </div>
                </div>
                <span className="text-sm font-medium">{formatCurrency(parseFloat(product.revenue))}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </FadeIn>

      {/* Recent Activity */}
      <FadeIn delay={0.7}>
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
                  {new Date(item.timestamp).toLocaleDateString()}
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
