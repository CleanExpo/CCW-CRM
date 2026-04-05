'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, DollarSign, ShoppingCart, Users, FileText, BarChart3 } from 'lucide-react';

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

interface TopProductDataPoint {
  name: string;
  revenue: string;
  quantity_sold: number;
}

interface QuoteConversionData {
  total_quotes: number;
  accepted: number;
  rejected: number;
  pending: number;
  expired: number;
  conversion_rate: number;
  average_quote_value: string;
  total_converted_revenue: string;
}

export function SalesKpiDashboard() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [revenue, setRevenue] = useState<RevenueDataPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductDataPoint[]>([]);
  const [quoteConversion, setQuoteConversion] = useState<QuoteConversionData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [metricsData, revenueData, topProductsData, quoteData] = await Promise.all([
        apiClient.get<DashboardMetrics>('/api/dashboard/metrics'),
        apiClient.get<RevenueDataPoint[]>('/api/dashboard/charts/revenue'),
        apiClient.get<TopProductDataPoint[]>('/api/dashboard/charts/top-products'),
        apiClient.get<QuoteConversionData>('/api/dashboard/quote-conversion'),
      ]);
      setMetrics(metricsData);
      setRevenue(revenueData);
      setTopProducts(topProductsData);
      setQuoteConversion(quoteData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load sales KPIs';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(num);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calculate MoM revenue change
  const revenueValues = revenue.map((r) => parseFloat(r.revenue) || 0);
  const currentMonthRevenue = revenueValues[revenueValues.length - 1] ?? 0;
  const prevMonthRevenue = revenueValues[revenueValues.length - 2] ?? 0;
  const momChange =
    prevMonthRevenue > 0
      ? (((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue This Month</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics?.total_revenue_this_month ?? '0')}
            </div>
            {momChange !== null && (
              <p className="text-muted-foreground mt-1 text-xs">
                <span className={parseFloat(momChange) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {parseFloat(momChange) >= 0 ? '+' : ''}
                  {momChange}%
                </span>{' '}
                vs last month
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <ShoppingCart className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.active_orders ?? 0}</div>
            <p className="text-muted-foreground mt-1 text-xs">Pending to shipped</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_customers ?? 0}</div>
            <p className="text-muted-foreground mt-1 text-xs">Active accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quote Conversion</CardTitle>
            <FileText className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quoteConversion?.conversion_rate ?? 0}%</div>
            <p className="text-muted-foreground mt-1 text-xs">
              {quoteConversion?.accepted ?? 0} of {quoteConversion?.total_quotes ?? 0} quotes
              accepted
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend + Quote Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue Trend (6 Months)
            </CardTitle>
            <CardDescription>Monthly delivered order revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {revenue.length === 0 ? (
              <p className="text-muted-foreground text-sm">No revenue data available</p>
            ) : (
              <div className="space-y-2">
                {revenue.map((point) => {
                  const value = parseFloat(point.revenue) || 0;
                  const maxRevenue = Math.max(...revenue.map((r) => parseFloat(r.revenue) || 0));
                  const barWidth = maxRevenue > 0 ? (value / maxRevenue) * 100 : 0;
                  return (
                    <div key={point.month} className="flex items-center gap-3">
                      <div className="text-muted-foreground w-16 text-right text-xs">
                        {point.month}
                      </div>
                      <div className="bg-muted h-2 flex-1 rounded-full">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="w-24 text-right text-xs font-medium">
                        {formatCurrency(point.revenue)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quote Pipeline</CardTitle>
            <CardDescription>Conversion funnel analysis</CardDescription>
          </CardHeader>
          <CardContent>
            {quoteConversion ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Avg Quote Value</div>
                    <div className="font-semibold">
                      {formatCurrency(quoteConversion.average_quote_value)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Converted Revenue</div>
                    <div className="font-semibold">
                      {formatCurrency(quoteConversion.total_converted_revenue)}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    {
                      label: 'Pending',
                      count: quoteConversion.pending,
                      variant: 'outline' as const,
                    },
                    {
                      label: 'Accepted',
                      count: quoteConversion.accepted,
                      variant: 'default' as const,
                    },
                    {
                      label: 'Rejected',
                      count: quoteConversion.rejected,
                      variant: 'destructive' as const,
                    },
                    {
                      label: 'Expired',
                      count: quoteConversion.expired,
                      variant: 'secondary' as const,
                    },
                  ].map(({ label, count, variant }) => (
                    <div key={label} className="flex items-center justify-between">
                      <Badge variant={variant}>{label}</Badge>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No quote data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Top Products by Revenue
          </CardTitle>
          <CardDescription>Best selling equipment by delivered order revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sales data available yet</p>
          ) : (
            <div className="space-y-3">
              {topProducts.slice(0, 10).map((product, index) => {
                const maxRevenue = parseFloat(topProducts[0]?.revenue ?? '0') || 1;
                const barWidth = (parseFloat(product.revenue) / maxRevenue) * 100;
                return (
                  <div key={product.name} className="flex items-center gap-3">
                    <div className="text-muted-foreground w-5 text-right text-xs">#{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{product.name}</div>
                      <div className="bg-muted mt-1 h-1.5 rounded-full">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-medium">{formatCurrency(product.revenue)}</div>
                      <div className="text-muted-foreground text-xs">
                        {product.quantity_sold} units
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
