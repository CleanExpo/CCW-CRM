"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { CheckCircle2, XCircle, ExternalLink, Unplug, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  startXeroAuth,
  disconnectXero,
  type XeroConnectionStatus,
} from "@/lib/api/xero";

interface XeroConnectionCardProps {
  status: XeroConnectionStatus | null;
  loading: boolean;
  onStatusChange: () => void;
}

export function XeroConnectionCard({ status, loading, onStatusChange }: XeroConnectionCardProps) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const authResponse = await startXeroAuth();

      // Show instructions in demo mode
      if (authResponse.mode === "demo") {
        toast({
          title: "Demo Mode Active",
          description: authResponse.instructions || "Xero integration is in demo mode.",
        });
        // In demo mode, connection is already "established"
        onStatusChange();
      } else {
        // Redirect to Xero authorization URL
        window.location.href = authResponse.authorization_url;
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to start Xero authorization",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectXero();
      toast({
        title: "Disconnected",
        description: "Xero integration has been disconnected",
      });
      onStatusChange();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Disconnection Failed",
        description: error.message || "Failed to disconnect Xero",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 fill-primary"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.341 14.887c-1.309 0-2.134-.877-2.134-2.134 0-1.258.825-2.134 2.134-2.134 1.309 0 2.134.876 2.134 2.134 0 1.257-.825 2.134-2.134 2.134zm-4.536 3.096c-1.551 0-2.617-1.066-2.617-2.617 0-1.55 1.066-2.616 2.617-2.616s2.616 1.066 2.616 2.616c0 1.551-1.065 2.617-2.616 2.617zm-8.27-3.096c-1.309 0-2.134-.877-2.134-2.134 0-1.258.825-2.134 2.134-2.134 1.309 0 2.134.876 2.134 2.134 0 1.257-.825 2.134-2.134 2.134zm4.536-7.632c-1.551 0-2.617-1.066-2.617-2.617 0-1.55 1.066-2.616 2.617-2.616s2.616 1.066 2.616 2.616c0 1.551-1.065 2.617-2.616 2.617z" />
              </svg>
            </div>
            <div>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-1 h-4 w-32" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.connected ?? false;
  const isDemo = status?.mode === "demo";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 fill-primary"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.341 14.887c-1.309 0-2.134-.877-2.134-2.134 0-1.258.825-2.134 2.134-2.134 1.309 0 2.134.876 2.134 2.134 0 1.257-.825 2.134-2.134 2.134zm-4.536 3.096c-1.551 0-2.617-1.066-2.617-2.617 0-1.55 1.066-2.616 2.617-2.616s2.616 1.066 2.616 2.616c0 1.551-1.065 2.617-2.616 2.617zm-8.27-3.096c-1.309 0-2.134-.877-2.134-2.134 0-1.258.825-2.134 2.134-2.134 1.309 0 2.134.876 2.134 2.134 0 1.257-.825 2.134-2.134 2.134zm4.536-7.632c-1.551 0-2.617-1.066-2.617-2.617 0-1.55 1.066-2.616 2.617-2.616s2.616 1.066 2.616 2.616c0 1.551-1.065 2.617-2.616 2.617z" />
              </svg>
            </div>
            <div>
              <CardTitle className="text-lg">Xero Accounting</CardTitle>
              <CardDescription>Sync invoices and payments</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <Badge variant="secondary" className="text-xs">
                Demo Mode
              </Badge>
            )}
            {isConnected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <XCircle className="h-3 w-3" />
                Disconnected
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && status?.tenant_name && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-sm text-muted-foreground">Connected to</p>
            <p className="font-medium">{status.tenant_name}</p>
            {isDemo && (
              <p className="mt-1 text-xs text-muted-foreground">
                Demo mode - No real API calls are made
              </p>
            )}
          </div>
        )}

        {status?.message && !isConnected && (
          <p className="text-sm text-muted-foreground">{status.message}</p>
        )}

        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                onClick={onStatusChange}
                disabled={disconnecting}
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Status
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={disconnecting}>
                    <Unplug className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect Xero?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will disconnect your Xero integration. You'll need to re-authorize to
                      sync invoices and payments again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect}>Disconnect</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button onClick={handleConnect} disabled={connecting} className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              {connecting ? "Connecting..." : "Connect to Xero"}
            </Button>
          )}
        </div>

        {!isConnected && (
          <div className="rounded-lg border border-muted bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>What happens when you connect:</strong>
              <br />• Orders will sync to Xero as invoices
              <br />• Payments will update order status automatically
              <br />• Customers will sync to Xero contacts
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
