'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Package,
  AlertTriangle,
  ArrowLeftRight,
  Settings,
  PackageOpen,
  DollarSign,
  BookOpen,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { inventoryApi } from '@/lib/api/inventory';
import type { InventoryDashboardSummary } from '@/types/inventory';
import { useToast } from '@/hooks/use-toast';
import { ScanComingSoon } from '@/components/dashboard/ScanComingSoon';
import { SectionHubModules, type HubModuleItem } from '@/components/dashboard/SectionHubModules';
import { StockTransferDialog } from './components/StockTransferDialog';
import { StockAdjustmentDialog } from './components/StockAdjustmentDialog';
import { ReorderPointDialog } from './components/ReorderPointDialog';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import {
  OperationsPageHeader,
  OperationsPageLayout,
} from '@/components/operations/OperationsPageHeader';
import { opCardClass, opHeroSurfaceClass } from '@/lib/operations/ui';
import { cn } from '@/lib/utils';

interface StockLocation {
  location: string;
  stock: number;
  reserved: number;
  available: number;
  reorder_point?: number;
  reorder_quantity?: number;
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

interface ReorderDialogState {
  productId: string;
  productName: string;
  productSku: string;
  location: string;
  currentReorderPoint?: number;
  currentReorderQty?: number;
}

const INVENTORY_MODULES: HubModuleItem[] = [
  {
    title: 'Products',
    description: 'SKU catalogue, pricing, and listing controls.',
    href: '/dashboard/inventory/products',
    icon: 'Package',
  },
  {
    title: 'Inventory overview',
    description: 'This page — health, reorder alerts, and stock by location.',
    href: '/dashboard/inventory',
    icon: 'LayoutDashboard',
  },
  {
    title: 'Bill of materials',
    description: 'Finished goods and component structures.',
    href: '/dashboard/inventory/bom',
    icon: 'Layers',
  },
  {
    title: 'Stock list',
    description: 'Filterable stock positions across warehouses.',
    href: '/dashboard/inventory/stock',
    icon: 'PackageSearch',
  },
  {
    title: 'Stock transfers',
    description: 'Move inventory between locations with audit trail.',
    href: '/dashboard/inventory/transfers',
    icon: 'PackageCheck',
  },
  {
    title: 'Reservations',
    description: 'Soft holds tied to sales orders and fulfilment.',
    href: '/dashboard/inventory/reservations',
    icon: 'Timer',
  },
  {
    title: 'Stock forecast',
    description: 'Demand and replenishment signals.',
    href: '/dashboard/inventory/forecast',
    icon: 'BarChart3',
  },
  {
    title: 'Warehouse ops',
    description: 'Floor tasks, picks, and operational throughput.',
    href: '/dashboard/inventory/warehouse',
    icon: 'Truck',
  },
  {
    title: 'Containers',
    description: 'Inbound logistics units and contents.',
    href: '/dashboard/inventory/containers',
    icon: 'Ship',
  },
  {
    title: 'Backorders',
    description: 'Unfilled demand waiting on supply.',
    href: '/dashboard/inventory/backorders',
    icon: 'AlertCircle',
  },
];

export default function InventoryPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState<InventoryDashboardSummary>({
    total_skus: 0,
    total_stock_value: 0,
    below_reorder_point: 0,
    active_reservations: 0,
  });
  const [stockHealth, setStockHealth] = useState<{
    critical: StockHealthItem[];
    low: StockHealthItem[];
    warning: StockHealthItem[];
  }>({ critical: [], low: [], warning: [] });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    name: string;
    sku: string;
  } | null>(null);
  const [reorderDialogItem, setReorderDialogItem] = useState<ReorderDialogState | null>(null);

  // Reorder alert state
  const [reorderAlerts, setReorderAlerts] = useState<
    Array<{
      product_id: string;
      sku: string;
      name: string;
      location: string;
      stock: number;
      reorder_point: number;
      reorder_quantity: number | null;
      supplier_id: string | null;
      supplier_name: string | null;
    }>
  >([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [triggeringReorder, setTriggeringReorder] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadSummary();
    loadStockHealth();
    loadReorderAlerts();
  }, []);

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const data = await inventoryApi.getSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to load inventory summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadReorderAlerts() {
    setAlertsLoading(true);
    try {
      const alerts = await inventoryApi.getReorderAlerts();
      setReorderAlerts(alerts);
    } catch {
      // non-fatal
    } finally {
      setAlertsLoading(false);
    }
  }

  async function handleTriggerAutoReorder(productId: string, location: string, key: string) {
    setTriggeringReorder((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await inventoryApi.triggerAutoReorder(productId, location);
      toast({
        title: `PO created: ${result.po_number}`,
        description: `${result.quantity} units ordered — status: ${result.status}`,
      });
      loadReorderAlerts();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Auto-reorder failed',
        description: error instanceof Error ? error.message : 'Could not create purchase order',
      });
    } finally {
      setTriggeringReorder((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function loadStockHealth() {
    try {
      const data = await apiClient.get<{
        critical: StockHealthItem[];
        low: StockHealthItem[];
        warning: StockHealthItem[];
      }>('/api/inventory/stock-health?threshold=20');
      setStockHealth(data);
    } catch (error) {
      console.error('Failed to load stock health:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStockLevelColor(available: number): string {
    if (available === 0) return 'text-red-600 dark:text-red-400';
    if (available <= 5) return 'text-red-600 dark:text-red-400';
    if (available <= 10) return 'text-orange-600 dark:text-orange-400';
    if (available <= 20) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  }

  function getStockLevelBadge(available: number): {
    label: string;
    variant: 'destructive' | 'secondary' | 'default';
  } {
    if (available === 0) return { label: 'Out of Stock', variant: 'destructive' };
    if (available <= 5) return { label: 'Critical', variant: 'destructive' };
    if (available <= 10) return { label: 'Low', variant: 'secondary' };
    if (available <= 20) return { label: 'Warning', variant: 'secondary' };
    return { label: 'In Stock', variant: 'default' };
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

  function handleReorderClick(product: StockHealthItem, loc: StockLocation) {
    setReorderDialogItem({
      productId: product.product_id,
      productName: product.product_name,
      productSku: product.product_sku,
      location: loc.location,
      currentReorderPoint: loc.reorder_point,
      currentReorderQty: loc.reorder_quantity,
    });
    setReorderDialogOpen(true);
  }

  function handleDialogSuccess() {
    loadStockHealth();
    loadSummary();
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Equipment Inventory Management</h1>
        <p className="text-muted-foreground">Loading equipment inventory...</p>
      </div>
    );
  }

  const allProducts = [...stockHealth.critical, ...stockHealth.low, ...stockHealth.warning];

  return (
    <ErrorBoundary>
      <OperationsPageLayout className="space-y-6">
        <OperationsPageHeader
          sectionLabel="Inventory"
          accent="lagoon"
          title="Inventory overview"
          description="Multi-location stock tracking across Brisbane, Sydney, and Melbourne with reorder monitoring."
          icon={Package}
        />

        <SectionHubModules modules={INVENTORY_MODULES} heading="Inventory modules" />

        {/* KPI Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className={cn(opCardClass, opHeroSurfaceClass)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total SKUs</CardTitle>
              <PackageOpen className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryLoading ? '—' : summary.total_skus}</div>
              <p className="text-muted-foreground text-xs">Distinct cleaning equipment SKUs</p>
            </CardContent>
          </Card>

          <Card className={cn(opCardClass, opHeroSurfaceClass)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
              <DollarSign className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryLoading ? '—' : formatCurrency(summary.total_stock_value)}
              </div>
              <p className="text-muted-foreground text-xs">Total equipment stock value</p>
            </CardContent>
          </Card>

          <Card className={cn(opCardClass, opHeroSurfaceClass)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Below Reorder</CardTitle>
              <AlertTriangle
                className={`h-4 w-4 ${
                  !summaryLoading && summary.below_reorder_point > 0
                    ? 'text-amber-500'
                    : 'text-muted-foreground'
                }`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  !summaryLoading && summary.below_reorder_point > 0 ? 'text-amber-500' : ''
                }`}
              >
                {summaryLoading ? '—' : summary.below_reorder_point}
              </div>
              <p className="text-muted-foreground text-xs">Equipment lines below reorder point</p>
            </CardContent>
          </Card>

          <Card className={cn(opCardClass, opHeroSurfaceClass)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Reservations</CardTitle>
              <BookOpen className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryLoading ? '—' : summary.active_reservations}
              </div>
              <p className="text-muted-foreground text-xs">
                Equipment reserved for customer orders
              </p>
            </CardContent>
          </Card>
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
              <p className="text-muted-foreground text-xs">Out of stock or ≤5 units</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <Package className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stockHealth.low.length}</div>
              <p className="text-muted-foreground text-xs">6–10 units — monitor reorder point</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warning Stock</CardTitle>
              <Settings className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stockHealth.warning.length}</div>
              <p className="text-muted-foreground text-xs">11-20 units or location imbalance</p>
            </CardContent>
          </Card>
        </div>

        {/* Reorder Alert Panel */}
        {(reorderAlerts.length > 0 || alertsLoading) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Reorder Alerts
                  </CardTitle>
                  <CardDescription>
                    Equipment below reorder point — auto-reorder purchase order available where a
                    rule is configured
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadReorderAlerts}
                  disabled={alertsLoading}
                >
                  {alertsLoading ? 'Loading…' : 'Refresh'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <p className="text-muted-foreground py-4 text-sm">Loading alerts…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium">SKU</th>
                        <th className="py-2 text-left font-medium">Equipment</th>
                        <th className="py-2 text-left font-medium">Location</th>
                        <th className="py-2 text-right font-medium">Stock</th>
                        <th className="py-2 text-right font-medium">Reorder Pt</th>
                        <th className="py-2 text-right font-medium">Reorder Qty</th>
                        <th className="py-2 text-left font-medium">Supplier</th>
                        <th className="py-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reorderAlerts.map((alert) => {
                        const key = `${alert.product_id}:${alert.location}`;
                        return (
                          <tr key={key} className="hover:bg-muted/40">
                            <td className="py-2 font-mono text-xs">{alert.sku}</td>
                            <td className="py-2">{alert.name}</td>
                            <td className="py-2 capitalize">{alert.location}</td>
                            <td className="text-destructive py-2 text-right font-semibold">
                              {alert.stock}
                            </td>
                            <td className="text-muted-foreground py-2 text-right">
                              {alert.reorder_point}
                            </td>
                            <td className="text-muted-foreground py-2 text-right">
                              {alert.reorder_quantity ?? '—'}
                            </td>
                            <td className="text-muted-foreground py-2">
                              {alert.supplier_name ?? '—'}
                            </td>
                            <td className="py-2 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!alert.supplier_id || triggeringReorder[key]}
                                onClick={() =>
                                  handleTriggerAutoReorder(alert.product_id, alert.location, key)
                                }
                              >
                                {triggeringReorder[key] ? 'Creating…' : 'Auto-Reorder'}
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
        )}

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Levels by Location</CardTitle>
            <CardDescription>
              Real-time inventory across Brisbane, Sydney, and Melbourne
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <ScanComingSoon context="Inventory" />
            </div>
            {allProducts.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>All products have healthy stock levels</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-medium">Product</th>
                      <th className="px-4 py-3 text-left font-medium">SKU</th>
                      <th className="px-4 py-3 text-center font-medium">Brisbane</th>
                      <th className="px-4 py-3 text-center font-medium">Sydney</th>
                      <th className="px-4 py-3 text-center font-medium">Melbourne</th>
                      <th className="px-4 py-3 text-center font-medium">Total</th>
                      <th className="px-4 py-3 text-center font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allProducts.map((product) => {
                      const brisbane = product.locations.find((l) => l.location === 'brisbane');
                      const sydney = product.locations.find((l) => l.location === 'sydney');
                      const melbourne = product.locations.find((l) => l.location === 'melbourne');
                      const badge = getStockLevelBadge(product.total_available);

                      return (
                        <tr
                          key={product.product_id}
                          className="hover:bg-muted/50 border-b transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">{product.product_name}</div>
                          </td>
                          <td className="text-muted-foreground px-4 py-3 text-sm">
                            {product.product_sku}
                          </td>
                          <td
                            className={`px-4 py-3 text-center font-mono ${getStockLevelColor(brisbane?.available || 0)}`}
                          >
                            {brisbane?.available || 0}
                            {(brisbane?.reserved || 0) > 0 && (
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({brisbane?.reserved} res)
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-center font-mono ${getStockLevelColor(sydney?.available || 0)}`}
                          >
                            {sydney?.available || 0}
                            {(sydney?.reserved || 0) > 0 && (
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({sydney?.reserved} res)
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-center font-mono ${getStockLevelColor(melbourne?.available || 0)}`}
                          >
                            {melbourne?.available || 0}
                            {(melbourne?.reserved || 0) > 0 && (
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({melbourne?.reserved} res)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-semibold">
                            {product.total_available}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </td>
                          <td className="space-x-1 px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTransferClick(product)}
                            >
                              <ArrowLeftRight className="mr-1 h-3 w-3" />
                              Transfer
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAdjustClick(product)}
                            >
                              <Settings className="mr-1 h-3 w-3" />
                              Adjust
                            </Button>
                            {/* Set Reorder button — opens for the first location that exists */}
                            {(brisbane || sydney || melbourne) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const loc = brisbane ?? sydney ?? melbourne;
                                  if (loc) handleReorderClick(product, loc);
                                }}
                              >
                                <PackageOpen className="mr-1 h-3 w-3" />
                                Reorder
                              </Button>
                            )}
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

        {reorderDialogItem && (
          <ReorderPointDialog
            open={reorderDialogOpen}
            onOpenChange={setReorderDialogOpen}
            productId={reorderDialogItem.productId}
            productName={reorderDialogItem.productName}
            productSku={reorderDialogItem.productSku}
            location={reorderDialogItem.location}
            currentReorderPoint={reorderDialogItem.currentReorderPoint}
            currentReorderQty={reorderDialogItem.currentReorderQty}
            onSuccess={handleDialogSuccess}
          />
        )}
      </OperationsPageLayout>
    </ErrorBoundary>
  );
}
