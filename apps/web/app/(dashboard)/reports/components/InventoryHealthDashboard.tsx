'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { Package, AlertTriangle, Warehouse, TrendingDown } from 'lucide-react';

interface InventoryDataPoint {
  warehouse: string;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
}

interface DashboardMetrics {
  total_products: number;
  low_stock_alerts: number;
}

interface CategoryDataPoint {
  category: string;
  value: string;
  percentage: number;
}

export function InventoryHealthDashboard() {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryDataPoint[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inventoryData, metricsData, catData] = await Promise.all([
        apiClient.get<InventoryDataPoint[]>('/api/dashboard/charts/inventory'),
        apiClient.get<DashboardMetrics>('/api/dashboard/metrics'),
        apiClient.get<CategoryDataPoint[]>('/api/dashboard/charts/categories'),
      ]);
      setInventory(inventoryData);
      setMetrics(metricsData);
      setCategoryData(catData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load inventory KPIs';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
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

  const totalProducts = metrics?.total_products ?? 0;
  const lowStockAlerts = metrics?.low_stock_alerts ?? 0;

  // Aggregate across all warehouses
  const totalInStock = inventory.reduce((sum, w) => sum + w.in_stock, 0);
  const totalLowStock = inventory.reduce((sum, w) => sum + w.low_stock, 0);
  const totalOutOfStock = inventory.reduce((sum, w) => sum + w.out_of_stock, 0);
  const fulfillmentRate =
    totalProducts > 0
      ? ((totalInStock / (totalInStock + totalOutOfStock + totalLowStock)) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active Products</CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-muted-foreground mt-1 text-xs">Active SKUs in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${lowStockAlerts > 0 ? 'text-amber-600' : 'text-green-600'}`}
            >
              {lowStockAlerts}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Products at 10 units or below</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fulfillment Rate</CardTitle>
            <TrendingDown className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${parseFloat(fulfillmentRate) >= 80 ? 'text-green-600' : 'text-amber-600'}`}
            >
              {fulfillmentRate}%
            </div>
            <p className="text-muted-foreground mt-1 text-xs">Products with stock available</p>
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-4 w-4" />
              Stock by Warehouse
            </CardTitle>
            <CardDescription>Current stock health per location</CardDescription>
          </CardHeader>
          <CardContent>
            {inventory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No warehouse data available</p>
            ) : (
              <div className="space-y-4">
                {inventory.map((warehouse) => {
                  const total = warehouse.in_stock + warehouse.low_stock + warehouse.out_of_stock;
                  return (
                    <div key={warehouse.warehouse} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{warehouse.warehouse}</span>
                        <span className="text-muted-foreground">{total} SKUs</span>
                      </div>
                      <div className="flex h-3 gap-1 overflow-hidden rounded-full">
                        {total > 0 && (
                          <>
                            <div
                              className="h-full bg-green-500"
                              style={{ width: `${(warehouse.in_stock / total) * 100}%` }}
                              title={`In stock: ${warehouse.in_stock}`}
                            />
                            <div
                              className="h-full bg-amber-400"
                              style={{ width: `${(warehouse.low_stock / total) * 100}%` }}
                              title={`Low stock: ${warehouse.low_stock}`}
                            />
                            <div
                              className="h-full bg-red-400"
                              style={{ width: `${(warehouse.out_of_stock / total) * 100}%` }}
                              title={`Out of stock: ${warehouse.out_of_stock}`}
                            />
                          </>
                        )}
                      </div>
                      <div className="text-muted-foreground flex gap-4 text-xs">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                          {warehouse.in_stock} in stock
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                          {warehouse.low_stock} low
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                          {warehouse.out_of_stock} out
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
            <CardDescription>Revenue distribution across product categories</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <p className="text-muted-foreground text-sm">No category data available yet</p>
            ) : (
              <div className="space-y-3">
                {categoryData.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate font-medium">{cat.category}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">
                          {cat.percentage}%
                        </span>
                      </div>
                      <div className="bg-muted h-2 rounded-full">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stock Health */}
      <Card>
        <CardHeader>
          <CardTitle>Aggregate Stock Health</CardTitle>
          <CardDescription>Combined stock status across all warehouse locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{totalInStock}</div>
              <div className="text-muted-foreground text-sm">In Stock</div>
              <Badge variant="outline" className="mt-1 border-green-200 text-green-600">
                Healthy
              </Badge>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">{totalLowStock}</div>
              <div className="text-muted-foreground text-sm">Low Stock</div>
              <Badge variant="outline" className="mt-1 border-amber-200 text-amber-600">
                Monitor
              </Badge>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{totalOutOfStock}</div>
              <div className="text-muted-foreground text-sm">Out of Stock</div>
              <Badge variant="destructive" className="mt-1">
                Action Required
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
