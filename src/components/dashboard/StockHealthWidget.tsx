'use client';

import { useState, useEffect, memo } from 'react';
import { Package, AlertTriangle, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MultiLocationStockCell,
  type StockByLocation,
} from '@/components/inventory/MultiLocationStockCell';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';

interface LowStockProduct {
  id: string;
  sku: string;
  name: string;
  stock_by_location: StockByLocation[];
  total_available: number;
  min_available: number; // Lowest availability across all locations
}

interface StockHealthData {
  critical: LowStockProduct[]; // total_available = 0
  low: LowStockProduct[]; // total_available > 0 and < 20
  warning: LowStockProduct[]; // any location = 0 but total > 0
}

// PHASE 4 OPTIMIZATION: Memoized to prevent unnecessary re-renders
export const StockHealthWidget = memo(function StockHealthWidget() {
  const [stockHealth, setStockHealth] = useState<StockHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStockHealth() {
      try {
        setLoading(true);
        const response = await apiClient.get<StockHealthData>(
          '/api/inventory/stock-health?threshold=20'
        );
        setStockHealth(response);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to load stock health data';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchStockHealth();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Health
          </CardTitle>
          <CardDescription>Loading stock health data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Health
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalIssues =
    (stockHealth?.critical.length || 0) +
    (stockHealth?.low.length || 0) +
    (stockHealth?.warning.length || 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Stock Health
            </CardTitle>
            <CardDescription>
              {totalIssues === 0
                ? 'All products have healthy stock levels'
                : `${totalIssues} product${totalIssues > 1 ? 's' : ''} requiring attention`}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/products">View All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {totalIssues === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Package className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p className="text-sm">All products have sufficient stock</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Critical Stock (Out of Stock Everywhere) */}
            {stockHealth && stockHealth.critical.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <h4 className="text-sm font-semibold text-red-600">
                    Critical - Out of Stock ({stockHealth.critical.length})
                  </h4>
                </div>
                <div className="space-y-3">
                  {stockHealth.critical.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-start justify-between rounded-lg border border-red-200 bg-red-50 p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono text-sm">
                            {product.sku}
                          </span>
                          <Badge variant="destructive" className="text-xs">
                            OUT OF STOCK
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium">{product.name}</p>
                        <div className="mt-2">
                          <MultiLocationStockCell
                            productId={product.id}
                            locations={product.stock_by_location}
                          />
                        </div>
                      </div>
                      <Button asChild size="sm" variant="default" className="ml-4">
                        <Link href={`/procurement?reorder=${product.id}`}>Order Now</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Stock (Total < 20) */}
            {stockHealth && stockHealth.low.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-yellow-600" />
                  <h4 className="text-sm font-semibold text-yellow-600">
                    Low Stock - Reorder Soon ({stockHealth.low.length})
                  </h4>
                </div>
                <div className="space-y-3">
                  {stockHealth.low.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-start justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono text-sm">
                            {product.sku}
                          </span>
                          <Badge
                            variant="secondary"
                            className="bg-yellow-100 text-xs text-yellow-800"
                          >
                            LOW STOCK
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium">{product.name}</p>
                        <div className="mt-2">
                          <MultiLocationStockCell
                            productId={product.id}
                            locations={product.stock_by_location}
                          />
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="ml-4">
                        <Link href={`/procurement?reorder=${product.id}`}>Reorder</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning (Out at one location but available elsewhere) */}
            {stockHealth && stockHealth.warning.length > 0 && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <h4 className="text-sm font-semibold text-orange-600">
                    Location Imbalance ({stockHealth.warning.length})
                  </h4>
                </div>
                <div className="space-y-3">
                  {stockHealth.warning.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-start justify-between rounded-lg border border-orange-200 bg-orange-50 p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono text-sm">
                            {product.sku}
                          </span>
                          <Badge
                            variant="outline"
                            className="border-orange-400 text-xs text-orange-700"
                          >
                            NEEDS TRANSFER
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium">{product.name}</p>
                        <div className="mt-2">
                          <MultiLocationStockCell
                            productId={product.id}
                            locations={product.stock_by_location}
                          />
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="ml-4">
                        <Link href={`/inventory/transfers?product=${product.id}`}>Transfer</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
