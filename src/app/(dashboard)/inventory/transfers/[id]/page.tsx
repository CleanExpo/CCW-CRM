"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowRight, Package, User, Calendar, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StockTransfer } from "@/types/inventory";
import { apiClient } from "@/lib/api/client";
import { TransferStatusBadge } from "@/components/inventory/TransferStatusBadge";
import { format } from "date-fns";

export default function TransferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [transfer, setTransfer] = useState<StockTransfer | null>(null);
  const [loading, setLoading] = useState(true);

  const transferId = params.id as string;

  useEffect(() => {
    async function loadTransfer() {
      setLoading(true);
      try {
        const response = await apiClient.get<StockTransfer>(`/api/inventory/transfers/${transferId}`);
        setTransfer(response);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to load transfer";
        console.error("Failed to load transfer:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: message,
        });
        router.push("/dashboard/inventory/transfers");
      } finally {
        setLoading(false);
      }
    }

    if (transferId) {
      loadTransfer();
    }
  }, [transferId, toast, router]);

  const handleBackToList = () => {
    router.push("/dashboard/inventory/transfers");
  };

  const handleMarkInTransit = async () => {
    if (!transfer || transfer.status !== "pending") return;

    try {
      await apiClient.post(`/api/inventory/transfers/${transferId}/status`, {
        status: "in_transit",
      });

      toast({
        title: "Success",
        description: "Transfer marked as in transit",
      });

      // Reload transfer
      const updated = await apiClient.get<StockTransfer>(`/api/inventory/transfers/${transferId}`);
      setTransfer(updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update transfer";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    }
  };

  const handleMarkCompleted = async () => {
    if (!transfer || transfer.status !== "in_transit") return;

    try {
      await apiClient.post(`/api/inventory/transfers/${transferId}/status`, {
        status: "completed",
      });

      toast({
        title: "Success",
        description: "Transfer marked as completed",
      });

      // Reload transfer
      const updated = await apiClient.get<StockTransfer>(`/api/inventory/transfers/${transferId}`);
      setTransfer(updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update transfer";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    }
  };

  const handleCancelTransfer = async () => {
    if (!transfer || transfer.status !== "pending") return;

    try {
      await apiClient.post(`/api/inventory/transfers/${transferId}/status`, {
        status: "cancelled",
      });

      toast({
        title: "Success",
        description: "Transfer cancelled",
      });

      // Reload transfer
      const updated = await apiClient.get<StockTransfer>(`/api/inventory/transfers/${transferId}`);
      setTransfer(updated);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to cancel transfer";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    }
  };

  const formatLocation = (location: string) => {
    return location.charAt(0).toUpperCase() + location.slice(1);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!transfer) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transfer Details</h1>
            <p className="text-muted-foreground">
              Transfer ID: {transfer.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        <TransferStatusBadge status={transfer.status} />
      </div>

      {/* Transfer Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Information</CardTitle>
          <CardDescription>Details about this stock transfer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product */}
          <div className="flex items-start gap-4">
            <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">Product</div>
              <div className="font-medium">{transfer.product_name || "—"}</div>
              <div className="text-sm text-muted-foreground font-mono">{transfer.product_sku || "—"}</div>
            </div>
          </div>

          {/* Transfer Route */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">From Location</div>
              <div className="font-medium text-lg">{formatLocation(transfer.from_location)}</div>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">To Location</div>
              <div className="font-medium text-lg">{formatLocation(transfer.to_location)}</div>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <div className="text-sm text-muted-foreground">Quantity</div>
            <div className="font-bold text-2xl">{transfer.quantity} units</div>
          </div>

          {/* Initiated */}
          <div className="flex items-start gap-4">
            <User className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm text-muted-foreground">Initiated By</div>
              <div className="font-medium">{transfer.initiated_by}</div>
              <div className="text-sm text-muted-foreground">
                <Calendar className="h-3 w-3 inline mr-1" />
                {format(new Date(transfer.initiated_at), "MMM d, yyyy 'at' h:mm a")}
              </div>
            </div>
          </div>

          {/* Completed */}
          {transfer.completed_at && (
            <div className="flex items-start gap-4">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="text-sm text-muted-foreground">Completed By</div>
                <div className="font-medium">{transfer.completed_by || "—"}</div>
                <div className="text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {format(new Date(transfer.completed_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          {transfer.reason && (
            <div>
              <div className="text-sm text-muted-foreground">Reason</div>
              <div className="font-medium">{transfer.reason}</div>
            </div>
          )}

          {/* Notes */}
          {transfer.notes && (
            <div>
              <div className="text-sm text-muted-foreground">Notes</div>
              <div className="text-sm">{transfer.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Timeline</CardTitle>
          <CardDescription>Status progression of this transfer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Pending */}
            <div className="flex items-start gap-4">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                transfer.status !== "cancelled" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
              }`}>
                <Clock className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Pending</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(transfer.initiated_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
            </div>

            {/* In Transit */}
            <div className="flex items-start gap-4">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                transfer.status === "in_transit" || transfer.status === "completed"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-400"
              }`}>
                <Package className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium">In Transit</div>
                <div className="text-sm text-muted-foreground">
                  {transfer.status === "in_transit" || transfer.status === "completed"
                    ? "In progress"
                    : "Not started"}
                </div>
              </div>
            </div>

            {/* Completed */}
            <div className="flex items-start gap-4">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                transfer.status === "completed"
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}>
                <CheckCircle className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Completed</div>
                <div className="text-sm text-muted-foreground">
                  {transfer.completed_at
                    ? format(new Date(transfer.completed_at), "MMM d, yyyy 'at' h:mm a")
                    : "Not completed"}
                </div>
              </div>
            </div>

            {/* Cancelled */}
            {transfer.status === "cancelled" && (
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-600">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">Cancelled</div>
                  <div className="text-sm text-muted-foreground">Transfer was cancelled</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Update transfer status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {transfer.status === "pending" && (
              <>
                <Button onClick={handleMarkInTransit}>
                  Mark as In Transit
                </Button>
                <Button variant="outline" onClick={handleCancelTransfer}>
                  Cancel Transfer
                </Button>
              </>
            )}
            {transfer.status === "in_transit" && (
              <Button onClick={handleMarkCompleted}>
                Mark as Completed
              </Button>
            )}
            {transfer.status === "completed" && (
              <div className="text-sm text-muted-foreground">
                Transfer is completed. No actions available.
              </div>
            )}
            {transfer.status === "cancelled" && (
              <div className="text-sm text-muted-foreground">
                Transfer was cancelled. No actions available.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
