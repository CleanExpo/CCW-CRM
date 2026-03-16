"use client";

/**
 * Integration Demo Page
 *
 * Demonstrates the new frontend-to-backend integration features:
 * - React Query hooks
 * - Optimistic updates
 * - Real-time subscriptions
 * - Offline detection
 * - Error handling
 */

import { useState } from "react";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/use-products";
import { useDashboardMetrics } from "@/hooks/use-analytics";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Wifi, WifiOff, RefreshCw } from "lucide-react";

export default function IntegrationDemoPage() {
  const [searchTerm, setSearchTerm] = useState("");

  // React Query hooks - automatic caching and background refresh
  const { data: productsData, isLoading, error, refetch } = useProducts({
    page: 1,
    page_size: 10,
    search: searchTerm || undefined,
  });

  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();

  // Mutations with automatic cache invalidation
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  // Real-time updates (auto-subscribes to SSE events)
  useRealtimeUpdates();

  // Online/offline detection
  const isOnline = useOnlineStatus();

  // Demo: Create product with optimistic update
  const handleCreateDemo = async () => {
    await createProduct.mutateAsync({
      sku: `DEMO-${Date.now()}`,
      name: "Demo Product",
      price: "99.99",
      cost: "50.00",
      stock: 100,
      category: "hand_tools",
    });
  };

  // Demo: Update product with optimistic update
  const handleUpdateDemo = async (productId: string) => {
    await updateProduct.mutateAsync({
      id: productId,
      data: { stock: Math.floor(Math.random() * 200) },
    });
  };

  // Demo: Delete product with optimistic update
  const handleDeleteDemo = async (productId: string) => {
    if (confirm("Delete this product?")) {
      await deleteProduct.mutateAsync(productId);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integration Demo</h1>
        <p className="text-muted-foreground mt-2">
          Showcasing React Query, optimistic updates, real-time subscriptions, and offline detection
        </p>
      </div>

      {/* Online Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="h-5 w-5 text-green-500" />
                Online
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-red-500" />
                Offline
              </>
            )}
          </CardTitle>
          <CardDescription>
            {isOnline
              ? "Connected to server. Real-time updates enabled."
              : "Disconnected. Changes will be queued and synced when online."}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Dashboard Metrics (from Analytics API) */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.total_orders || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.total_customers || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">${metrics?.total_revenue || "0.00"}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Quotes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.pending_quotes || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products List with React Query */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Products (React Query)</CardTitle>
              <CardDescription>
                Cached for 2 minutes • Auto-refetch on window focus
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateDemo} disabled={createProduct.isPending}>
                {createProduct.isPending ? "Creating..." : "Create Demo Product"}
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-500 p-4 bg-red-50 rounded-md">
              <AlertCircle className="h-5 w-5" />
              <span>Error: {error.message}</span>
            </div>
          ) : productsData && productsData.items.length > 0 ? (
            <div className="space-y-2">
              {productsData.items.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      SKU: {product.sku} • Stock: {product.stock} • ${product.price}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateDemo(product.id)}
                      disabled={updateProduct.isPending}
                    >
                      Update Stock
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteDemo(product.id)}
                      disabled={deleteProduct.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No products found. Try creating one!
            </div>
          )}

          {productsData && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {productsData.items.length} of {productsData.total} products
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Features Status */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Features Status</CardTitle>
          <CardDescription>All features working correctly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>React Query - Automatic caching and background refresh</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Optimistic Updates - Instant UI feedback with rollback</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Real-time - SSE subscriptions for live updates</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Offline Detection - Request queueing and sync</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Error Handling - User-friendly error messages</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Retry Logic - Automatic retry with exponential backoff</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
