"use client";

import { useState, useEffect } from "react";
import { Package, AlertTriangle, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiLocationStockCell, type StockByLocation } from "@/components/inventory/MultiLocationStockCell";
import { apiClient } from "@/lib/api/client";
import Link from "next/link";

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

export function StockHealthWidget() {
  const [stockHealth, setStockHealth] = useState<StockHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStockHealth() {
      try {
        setLoading(true);
        const response = await apiClient.get<StockHealthData>("/api/inventory/stock-health?threshold=20");
        setStockHealth(response);
      } catch (err: any) {
        setError(err.message || "Failed to load stock health data");
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
                ? "All products have healthy stock levels"
                : `${totalIssues} product${totalIssues > 1 ? "s" : ""} requiring attention`}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/products">View All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {totalIssues === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">All products have sufficient stock</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Critical Stock (Out of Stock Everywhere) */}
            {stockHealth && stockHealth.critical.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <h4 className="text-sm font-semibold text-red-600">
                    Critical - Out of Stock ({stockHealth.critical.length})
                  </h4>
                </div>
                <div className="space-y-3">
                  {stockHealth.critical.map((product) => (
                    <div
                      key={product.id}
                      className="flex justify-between items-start p-3 rounded-lg border border-red-200 bg-red-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-muted-foreground">
                            {product.sku}
                          </span>
                          <Badge variant="destructive" className="text-xs">
                            OUT OF STOCK
                          </Badge>
                        </div>
                        <p className="font-medium mt-1">{product.name}</p>
                        <div className="mt-2">
                          <MultiLocationStockCell
                            productId={product.id}
                            locations={product.stock_by_location}
                          />
                        </div>
                      </div>
                      <Button asChild size="sm" variant="default" className="ml-4">
                        <Link href={`/procurement?reorder=${product.id}` as any}>Order Now</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Low Stock (Total < 20) */}
            {stockHealth && stockHealth.low.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-yellow-600" />
                  <h4 className="text-sm font-semibold text-yellow-600">
                    Low Stock - Reorder Soon ({stockHealth.low.length})
                  </h4>
                </div>
                <div className="space-y-3">
                  {stockHealth.low.map((product) => (
                    <div
                      key={product.id}
                      className="flex justify-between items-start p-3 rounded-lg border border-yellow-200 bg-yellow-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-muted-foreground">
                            {product.sku}
                          </span>
                          <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                            LOW STOCK
                          </Badge>
                        </div>
                        <p className="font-medium mt-1">{product.name}</p>
                        <div className="mt-2">
                          <MultiLocationStockCell
                            productId={product.id}
                            locations={product.stock_by_location}
                          />
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="ml-4">
                        <Link href={`/procurement?reorder=${product.id}` as any}>Reorder</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning (Out at one location but available elsewhere) */}
            {stockHealth && stockHealth.warning.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <h4 className="text-sm font-semibold text-orange-600">
                    Location Imbalance ({stockHealth.warning.length})
                  </h4>
                </div>
                <div className="space-y-3">
                  {stockHealth.warning.map((product) => (
                    <div
                      key={product.id}
                      className="flex justify-between items-start p-3 rounded-lg border border-orange-200 bg-orange-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-muted-foreground">
                            {product.sku}
                          </span>
                          <Badge variant="outline" className="text-xs border-orange-400 text-orange-700">
                            NEEDS TRANSFER
                          </Badge>
                        </div>
                        <p className="font-medium mt-1">{product.name}</p>
                        <div className="mt-2">
                          <MultiLocationStockCell
                            productId={product.id}
                            locations={product.stock_by_location}
                          />
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="ml-4">
                        <Link href={`/inventory/transfers?product=${product.id}` as any}>Transfer</Link>
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
}
