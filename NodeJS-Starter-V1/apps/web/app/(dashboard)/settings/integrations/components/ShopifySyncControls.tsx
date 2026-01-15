"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, FileText, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  importShopifyOrder,
  importRecentShopifyOrders,
  syncAllInventory,
  type ShopifyOrderImportResult,
  type ShopifyBulkImportResult,
  type ShopifyBulkInventorySyncResult,
} from "@/lib/api/shopify";

interface ShopifySyncControlsProps {
  isConnected: boolean;
}

export function ShopifySyncControls({ isConnected }: ShopifySyncControlsProps) {
  const { toast } = useToast();

  // Order import state
  const [orderId, setOrderId] = useState("");
  const [importingOrder, setImportingOrder] = useState(false);
  const [lastOrderImport, setLastOrderImport] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Bulk import state
  const [maxOrders, setMaxOrders] = useState(50);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [lastBulkImport, setLastBulkImport] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Inventory sync state
  const [syncingInventory, setSyncingInventory] = useState(false);
  const [lastInventorySync, setLastInventorySync] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleImportOrder = async () => {
    if (!orderId.trim()) {
      toast({
        variant: "destructive",
        title: "Order ID Required",
        description: "Please enter a Shopify order ID",
      });
      return;
    }

    setImportingOrder(true);
    setLastOrderImport(null);

    try {
      const result: ShopifyOrderImportResult = await importShopifyOrder(
        orderId.trim()
      );

      setLastOrderImport({
        success: true,
        message: `Order ${result.order_number} imported successfully! Total: $${result.total.toFixed(2)}`,
      });

      toast({
        title: "Order Imported",
        description: `Order ${result.order_number} has been imported into the ERP`,
      });

      setOrderId("");
    } catch (error: any) {
      setLastOrderImport({
        success: false,
        message: error.message || "Failed to import order",
      });

      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import order from Shopify",
      });
    } finally {
      setImportingOrder(false);
    }
  };

  const handleBulkImport = async () => {
    setBulkImporting(true);
    setLastBulkImport(null);

    try {
      const result: ShopifyBulkImportResult = await importRecentShopifyOrders(
        maxOrders
      );

      setLastBulkImport({
        success: true,
        message: `Successfully imported ${result.imported_count} orders from Shopify`,
      });

      toast({
        title: "Bulk Import Complete",
        description: `Imported ${result.imported_count} orders from Shopify`,
      });
    } catch (error: any) {
      setLastBulkImport({
        success: false,
        message: error.message || "Failed to import orders",
      });

      toast({
        variant: "destructive",
        title: "Bulk Import Failed",
        description: error.message || "Failed to import orders from Shopify",
      });
    } finally {
      setBulkImporting(false);
    }
  };

  const handleSyncInventory = async () => {
    setSyncingInventory(true);
    setLastInventorySync(null);

    try {
      const result: ShopifyBulkInventorySyncResult = await syncAllInventory();

      setLastInventorySync({
        success: true,
        message: `Synced ${result.synced} of ${result.total} products. ${result.failed} failed.`,
      });

      toast({
        title: "Inventory Synced",
        description: `Successfully synced ${result.synced} products to Shopify`,
      });
    } catch (error: any) {
      setLastInventorySync({
        success: false,
        message: error.message || "Failed to sync inventory",
      });

      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message || "Failed to sync inventory to Shopify",
      });
    } finally {
      setSyncingInventory(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Order Import Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Order Import
          </CardTitle>
          <CardDescription>
            Import orders from Shopify into the ERP system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Import Single Order */}
          <div className="space-y-2">
            <Label htmlFor="orderId">Import Single Order</Label>
            <div className="flex gap-2">
              <Input
                id="orderId"
                placeholder="Enter Shopify order ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !importingOrder && orderId.trim()) {
                    handleImportOrder();
                  }
                }}
                disabled={!isConnected || importingOrder}
              />
              <Button
                onClick={handleImportOrder}
                disabled={!isConnected || importingOrder || !orderId.trim()}
              >
                {importingOrder ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>

          {/* Bulk Import */}
          <div className="space-y-2">
            <Label htmlFor="maxOrders">Bulk Import Recent Orders</Label>
            <div className="flex gap-2">
              <Input
                id="maxOrders"
                type="number"
                min="1"
                max="100"
                value={maxOrders}
                onChange={(e) => setMaxOrders(parseInt(e.target.value) || 50)}
                disabled={!isConnected || bulkImporting}
                className="w-24"
              />
              <span className="flex items-center text-sm text-muted-foreground">
                orders
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={!isConnected || bulkImporting}
                    variant="secondary"
                    className="ml-auto"
                  >
                    {bulkImporting ? "Importing..." : "Bulk Import"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bulk Import Orders?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will import up to {maxOrders} recent orders from
                      Shopify. Orders that have already been imported will be
                      skipped.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBulkImport}>
                      Import Orders
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Last Import Result */}
          {(lastOrderImport || lastBulkImport) && (
            <div
              className={`rounded-lg border p-3 ${
                lastOrderImport?.success || lastBulkImport?.success
                  ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                  : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
              }`}
            >
              <div className="flex items-start gap-2">
                {lastOrderImport?.success || lastBulkImport?.success ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-red-600 dark:text-red-400" />
                )}
                <p className="flex-1 text-sm">
                  {lastOrderImport?.message || lastBulkImport?.message}
                </p>
              </div>
            </div>
          )}

          {!isConnected && (
            <div className="rounded-lg border border-muted-foreground/20 bg-muted/50 p-3 text-xs text-muted-foreground">
              <AlertCircle className="mb-1 h-4 w-4" />
              <p>Connect to Shopify to enable order import</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Sync Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Inventory Sync
          </CardTitle>
          <CardDescription>
            Sync product inventory from ERP to Shopify
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Sync All Products</Label>
            <p className="text-xs text-muted-foreground">
              Update Shopify inventory levels for all mapped products
            </p>
            <Button
              onClick={handleSyncInventory}
              disabled={!isConnected || syncingInventory}
              className="w-full"
            >
              {syncingInventory ? "Syncing..." : "Sync Inventory"}
            </Button>
          </div>

          {/* Last Sync Result */}
          {lastInventorySync && (
            <div
              className={`rounded-lg border p-3 ${
                lastInventorySync.success
                  ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                  : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
              }`}
            >
              <div className="flex items-start gap-2">
                {lastInventorySync.success ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-red-600 dark:text-red-400" />
                )}
                <p className="flex-1 text-sm">{lastInventorySync.message}</p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
            <p className="font-medium">Automatic Inventory Sync</p>
            <p className="mt-1">
              Inventory updates are automatically synced to Shopify when stock
              levels change in the ERP system.
            </p>
          </div>

          {!isConnected && (
            <div className="rounded-lg border border-muted-foreground/20 bg-muted/50 p-3 text-xs text-muted-foreground">
              <AlertCircle className="mb-1 h-4 w-4" />
              <p>Connect to Shopify to enable inventory sync</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
