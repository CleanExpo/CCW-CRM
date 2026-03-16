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
import type { Cin7ConnectionStatus } from "@/lib/api/cin7";
import { connectCin7, disconnectCin7 } from "@/lib/api/cin7";

interface Cin7ConnectionCardProps {
  status: Cin7ConnectionStatus | null;
  loading: boolean;
  onStatusChange: () => void;
}

export function Cin7ConnectionCard({
  status,
  loading,
  onStatusChange,
}: Cin7ConnectionCardProps) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isConnected = status?.connected ?? false;
  const isDemo = status?.mode === "demo";

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await connectCin7();

      if (response.mode === "demo") {
        toast({
          title: "Demo Mode Active",
          description: response.message || "Cin7 demo mode is now active",
        });
      } else {
        toast({
          title: "Connected to Cin7",
          description: "Successfully connected to Cin7 inventory system",
        });
      }

      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to Cin7",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectCin7();

      toast({
        title: "Disconnected",
        description: "Cin7 integration has been disconnected",
      });

      onStatusChange();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Disconnect Failed",
        description: error instanceof Error ? error.message : "Failed to disconnect from Cin7",
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
            {/* Cin7 logo placeholder */}
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-indigo-600">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div>
              <CardTitle>Cin7 Inventory</CardTitle>
              <CardDescription>Sync products, orders & stock</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && isConnected && (
              <Badge variant="secondary">Demo Mode</Badge>
            )}
            {isConnected && status?.core_connected && (
              <Badge variant="outline" className="text-xs">Core</Badge>
            )}
            {isConnected && status?.omni_connected && (
              <Badge variant="outline" className="text-xs">Omni</Badge>
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
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                    Cin7 Integration Active
                  </p>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    {isDemo
                      ? "Demo mode - No real API calls will be made"
                      : "Connected to Cin7 inventory management"}
                  </p>
                </div>
              </div>
            </div>

            {status?.last_sync && (
              <div className="text-sm text-muted-foreground">
                Last sync:{" "}
                {new Date(status.last_sync).toLocaleString()}
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
                    <AlertDialogTitle>Disconnect Cin7?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will stop product, inventory, and order sync with Cin7. You can
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
                  <p className="font-medium">No active Cin7 connection</p>
                  <p className="mt-1 text-xs">
                    Connect to enable product, inventory, and order sync.
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
              {connecting ? "Connecting..." : "Connect to Cin7"}
            </Button>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
              <p className="font-medium">What happens when you connect:</p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Products and pricing will sync from Cin7</li>
                <li>Inventory levels update in real-time</li>
                <li>Customer and order data will synchronize</li>
                <li>Purchase orders sync with suppliers</li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
