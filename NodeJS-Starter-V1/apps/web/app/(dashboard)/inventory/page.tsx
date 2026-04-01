"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, ArrowLeftRight, Settings } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { StockTransferDialog } from "./components/StockTransferDialog";
import { StockAdjustmentDialog } from "./components/StockAdjustmentDialog";
import { useRealTimeInventory } from "@/hooks/use-real-time-inventory";

interface StockLocation {
  location: string;
  stock: number;
  reserved: number;
  available: number;
}

interface ProductStock {
  product_id: string;
  product_name: string;
  product_sku: string;
  total_stock: number;
  total_reserved: number;
  total_available: number;
  locations: StockLocation[];
}

interface StockHealthItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  total_stock: number;
  total_available: number;
  locations: StockLocation[];
}

export default function InventoryPage() {
  const [loading, setLoading] = useState(true);
  const [stockHealth, setStockHealth] = useState<{
    critical: StockHealthItem[];
    low: StockHealthItem[];
    warning: StockHealthItem[];
  }>({ critical: [], low: [], warning: [] });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string; sku: string } | null>(null);

  const loadStockHealth = useCallback(async () => {
    try {
      const data = await apiClient.get<{
        critical: StockHealthItem[];
        low: StockHealthItem[];
        warning: StockHealthItem[];
      }>("/api/inventory/stock-health?threshold=20");
      setStockHealth(data);
    } catch (error) {
      console.error("Failed to load stock health:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Enable real-time inventory updates via WebSocket
  useRealTimeInventory({
    showNotifications: true,
    onInventoryUpdate: loadStockHealth,
  });

  useEffect(() => {
    loadStockHealth();
  }, [loadStockHealth]);

  function getStockLevelColor(available: number): string {
    if (available === 0) return "text-red-600 dark:text-red-400";
    if (available <= 5) return "text-red-600 dark:text-red-400";
    if (available <= 10) return "text-orange-600 dark:text-orange-400";
    if (available <= 20) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  }

  function getStockLevelBadge(available: number): { label: string; variant: "destructive" | "secondary" | "default" } {
    if (available === 0) return { label: "Out of Stock", variant: "destructive" };
    if (available <= 5) return { label: "Critical", variant: "destructive" };
    if (available <= 10) return { label: "Low", variant: "secondary" };
    if (available <= 20) return { label: "Warning", variant: "secondary" };
    return { label: "In Stock", variant: "default" };
  }

  function handleTransferClick(product: StockHealthItem) {
    setSelectedProduct({
      id: product.product_id,
      name: product.product_name,
      sku: product.product_sku,
    });
    setTransferDialogOpen(true);
  }

  function handleAdjustClick(product: StockHealthItem) {
    setSelectedProduct({
      id: product.product_id,
      name: product.product_name,
      sku: product.product_sku,
    });
    setAdjustmentDialogOpen(true);
  }

  function handleDialogSuccess() {
    loadStockHealth();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
        <p className="text-muted-foreground">Loading inventory data...</p>
      </div>
    );
  }

  const allProducts = [...stockHealth.critical, ...stockHealth.low, ...stockHealth.warning];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground">Multi-location stock tracking and management</p>
        </div>
      </div>

      {/* Stock Health Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stockHealth.critical.length}</div>
            <p className="text-xs text-muted-foreground">Out of stock or ≤5 units</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stockHealth.low.length}</div>
            <p className="text-xs text-muted-foreground">6-10 units available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning Stock</CardTitle>
            <Settings className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stockHealth.warning.length}</div>
            <p className="text-xs text-muted-foreground">11-20 units or location imbalance</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Levels by Location</CardTitle>
          <CardDescription>
            Real-time inventory across Brisbane, Sydney, and Melbourne
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>All products have healthy stock levels</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Product</th>
                    <th className="text-left py-3 px-4 font-medium">SKU</th>
                    <th className="text-center py-3 px-4 font-medium">Brisbane</th>
                    <th className="text-center py-3 px-4 font-medium">Sydney</th>
                    <th className="text-center py-3 px-4 font-medium">Melbourne</th>
                    <th className="text-center py-3 px-4 font-medium">Total</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allProducts.map((product) => {
                    const brisbane = product.locations.find(l => l.location === "brisbane");
                    const sydney = product.locations.find(l => l.location === "sydney");
                    const melbourne = product.locations.find(l => l.location === "melbourne");
                    const badge = getStockLevelBadge(product.total_available);

                    return (
                      <tr key={product.product_id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{product.product_name}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {product.product_sku}
                        </td>
                        <td className={`py-3 px-4 text-center font-mono ${getStockLevelColor(brisbane?.available || 0)}`}>
                          {brisbane?.available || 0}
                          {(brisbane?.reserved || 0) > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({brisbane.reserved} res)
                            </span>
                          )}
                        </td>
                        <td className={`py-3 px-4 text-center font-mono ${getStockLevelColor(sydney?.available || 0)}`}>
                          {sydney?.available || 0}
                          {(sydney?.reserved || 0) > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({sydney.reserved} res)
                            </span>
                          )}
                        </td>
                        <td className={`py-3 px-4 text-center font-mono ${getStockLevelColor(melbourne?.available || 0)}`}>
                          {melbourne?.available || 0}
                          {(melbourne?.reserved || 0) > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({melbourne.reserved} res)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-semibold">
                          {product.total_available}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTransferClick(product)}
                          >
                            <ArrowLeftRight className="h-3 w-3 mr-1" />
                            Transfer
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAdjustClick(product)}
                          >
                            <Settings className="h-3 w-3 mr-1" />
                            Adjust
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {selectedProduct && (
        <>
          <StockTransferDialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            productSku={selectedProduct.sku}
            onSuccess={handleDialogSuccess}
          />
          <StockAdjustmentDialog
            open={adjustmentDialogOpen}
            onOpenChange={setAdjustmentDialogOpen}
            productId={selectedProduct.id}
            productName={selectedProduct.name}
            productSku={selectedProduct.sku}
            onSuccess={handleDialogSuccess}
          />
        </>
      )}
    </div>
  );
}
