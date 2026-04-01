"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { syncOrderToXero, bulkSyncOrders } from "@/lib/api/xero";

interface XeroSyncControlsProps {
  isConnected: boolean;
}

export function XeroSyncControls({ isConnected }: XeroSyncControlsProps) {
  const { toast } = useToast();
  const [orderId, setOrderId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [maxOrders, setMaxOrders] = useState("10");
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSyncOrder = async () => {
    if (!orderId.trim()) {
      toast({
        variant: "destructive",
        title: "Order ID Required",
        description: "Please enter an order ID to sync",
      });
      return;
    }

    setSyncing(true);
    setLastSyncResult(null);

    try {
      const result = await syncOrderToXero(orderId.trim());
      setLastSyncResult({
        success: true,
        message: `Order ${result.order_number} synced successfully! Xero Invoice: ${result.xero_invoice_number}`,
      });
      toast({
        title: "Order Synced",
        description: `Invoice ${result.xero_invoice_number} created in Xero`,
      });
      setOrderId(""); // Clear input on success
    } catch (error: any) {
      setLastSyncResult({
        success: false,
        message: error.message || "Failed to sync order",
      });
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error.message || "Failed to sync order to Xero",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkSync = async () => {
    setBulkSyncing(true);
    setLastSyncResult(null);

    try {
      const max = parseInt(maxOrders) || 10;
      const result = await bulkSyncOrders(max);

      setLastSyncResult({
        success: result.synced > 0,
        message: `Synced ${result.synced} of ${result.total} orders. ${result.failed} failed.`,
      });

      if (result.synced > 0) {
        toast({
          title: "Bulk Sync Complete",
          description: `Successfully synced ${result.synced} orders to Xero`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Bulk Sync Failed",
          description: result.errors?.[0] || "No orders were synced",
        });
      }
    } catch (error: any) {
      setLastSyncResult({
        success: false,
        message: error.message || "Failed to sync orders",
      });
      toast({
        variant: "destructive",
        title: "Bulk Sync Failed",
        description: error.message || "Failed to sync orders to Xero",
      });
    } finally {
      setBulkSyncing(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="text-lg">Manual Sync Controls</CardTitle>
          <CardDescription>Connect to Xero to enable manual sync</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center rounded-lg border border-dashed p-8">
            <p className="text-sm text-muted-foreground">
              Connect to Xero above to access sync controls
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Manual Sync Controls</CardTitle>
        <CardDescription>Manually trigger invoice sync to Xero</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sync Single Order */}
        <div className="space-y-3">
          <Label htmlFor="orderId">Sync Single Order</Label>
          <div className="flex gap-2">
            <Input
              id="orderId"
              placeholder="Enter order ID or number"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              disabled={syncing}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !syncing) {
                  handleSyncOrder();
                }
              }}
            />
            <Button onClick={handleSyncOrder} disabled={syncing || !orderId.trim()}>
              <FileText className="mr-2 h-4 w-4" />
              {syncing ? "Syncing..." : "Sync"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sync a specific order to Xero as an invoice
          </p>
        </div>

        {/* Bulk Sync */}
        <div className="space-y-3">
          <Label htmlFor="maxOrders">Bulk Sync Unsynced Orders</Label>
          <div className="flex gap-2">
            <Input
              id="maxOrders"
              type="number"
              min="1"
              max="100"
              placeholder="Max orders"
              value={maxOrders}
              onChange={(e) => setMaxOrders(e.target.value)}
              disabled={bulkSyncing}
              className="w-32"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={bulkSyncing} variant="secondary" className="flex-1">
                  <Upload className="mr-2 h-4 w-4" />
                  {bulkSyncing ? "Syncing..." : "Bulk Sync"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Bulk Sync Orders?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will sync up to {maxOrders} unsynced orders to Xero. Invoices will be
                    created for each order.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkSync}>Sync Orders</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-xs text-muted-foreground">
            Sync multiple unsynced orders to Xero at once (max 100)
          </p>
        </div>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-3 ${
              lastSyncResult.success
                ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
            }`}
          >
            {lastSyncResult.success ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  lastSyncResult.success
                    ? "text-green-900 dark:text-green-100"
                    : "text-red-900 dark:text-red-100"
                }`}
              >
                {lastSyncResult.success ? "Sync Successful" : "Sync Failed"}
              </p>
              <p
                className={`mt-1 text-xs ${
                  lastSyncResult.success
                    ? "text-green-700 dark:text-green-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {lastSyncResult.message}
              </p>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-lg border border-muted bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Automatic Sync:</strong> New orders are automatically synced to Xero when their
            status changes to "confirmed". Use manual sync for testing or re-syncing specific
            orders.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
