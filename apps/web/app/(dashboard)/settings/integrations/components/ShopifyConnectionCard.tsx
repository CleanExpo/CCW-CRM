"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, Unplug, XCircle } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { ShopifyConnectionStatus } from "@/lib/api/shopify";
import { connectShopify, disconnectShopify } from "@/lib/api/shopify";

interface ShopifyConnectionCardProps {
  status: ShopifyConnectionStatus | null;
  loading: boolean;
  onStatusChange: () => void;
}

export function ShopifyConnectionCard({
  status,
  loading,
  onStatusChange,
}: ShopifyConnectionCardProps) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isConnected = status?.connected ?? false;
  const isDemo = status?.mode === "demo";

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await connectShopify();

      if (response.mode === "demo") {
        toast({
          title: "Demo Mode Active",
          description: response.message || "Shopify demo mode is now active",
        });
      } else {
        toast({
          title: "Connected to Shopify",
          description: `Successfully connected to ${response.shop_name}`,
        });
      }

      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to Shopify",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectShopify();

      toast({
        title: "Disconnected",
        description: "Shopify integration has been disconnected",
      });

      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error instanceof Error ? error.message : "Failed to disconnect from Shopify",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onStatusChange();
      toast({
        title: "Status Refreshed",
        description: "Connection status has been updated",
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Failed to refresh status",
      });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Shopify logo */}
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-green-600">
                <path d="M16.93 0H7.07a1.2 1.2 0 0 0-1.2 1.2v21.6c0 .66.54 1.2 1.2 1.2h9.86c.66 0 1.2-.54 1.2-1.2V1.2c0-.66-.54-1.2-1.2-1.2zm-4.93 21.9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM16 15H8V3h8v12z" />
              </svg>
            </div>
            <div>
              <CardTitle>Shopify Store</CardTitle>
              <CardDescription>Sync orders and inventory</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && isConnected && (
              <Badge variant="secondary">Demo Mode</Badge>
            )}
            {isConnected ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Disconnected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    {status?.shop_name || status?.shop_domain}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    {isDemo
                      ? "Demo mode - No real API calls will be made"
                      : "Connected to Shopify store"}
                  </p>
                </div>
              </div>
            </div>

            {status?.last_order_sync && (
              <div className="text-sm text-muted-foreground">
                Last order sync:{" "}
                {new Date(status.last_order_sync).toLocaleString()}
              </div>
            )}

            {status?.last_inventory_sync && (
              <div className="text-sm text-muted-foreground">
                Last inventory sync:{" "}
                {new Date(status.last_inventory_sync).toLocaleString()}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={refreshing}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh Status
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={disconnecting}>
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Shopify?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop order imports and inventory sync. You can
                      reconnect at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-muted-foreground/20 bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-sm text-muted-foreground">
                  <p className="font-medium">No active Shopify connection</p>
                  <p className="mt-1 text-xs">
                    Connect to enable order imports and inventory sync.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {connecting ? "Connecting..." : "Connect to Shopify"}
            </Button>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
              <p className="font-medium">What happens when you connect:</p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Orders from Shopify will be imported automatically</li>
                <li>Inventory levels will sync from ERP to Shopify</li>
                <li>Customer information will be synchronized</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
