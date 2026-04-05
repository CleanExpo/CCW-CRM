"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, Truck, PackageCheck, XCircle, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

interface OrderStatusActionsProps {
  orderId: string;
  currentStatus: string;
  orderNumber: string;
  onStatusChange: () => void;
}

interface StatusTransition {
  from: string;
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "destructive" | "outline" | "secondary";
}

const STATUS_TRANSITIONS: StatusTransition[] = [
  {
    from: "draft",
    to: "confirmed",
    label: "Confirm Order",
    icon: Check,
    variant: "default",
  },
  {
    from: "pending",
    to: "confirmed",
    label: "Confirm Order",
    icon: Check,
    variant: "default",
  },
  {
    from: "confirmed",
    to: "processing",
    label: "Start Processing",
    icon: PackageCheck,
    variant: "default",
  },
  {
    from: "processing",
    to: "shipped",
    label: "Mark as Shipped",
    icon: Truck,
    variant: "default",
  },
  {
    from: "shipped",
    to: "delivered",
    label: "Mark as Delivered",
    icon: Check,
    variant: "default",
  },
];

export function OrderStatusActions({
  orderId,
  currentStatus,
  orderNumber,
  onStatusChange,
}: OrderStatusActionsProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<StatusTransition | null>(null);
  const [fulfillmentLocation, setFulfillmentLocation] = useState<string>("brisbane");

  // Don't show actions for completed or cancelled orders
  if (currentStatus === "delivered" || currentStatus === "cancelled") {
    return null;
  }

  // Find available transition for current status
  const availableTransition = STATUS_TRANSITIONS.find(
    (t) => t.from === currentStatus
  );

  const handleTransitionClick = (transition: StatusTransition) => {
    setSelectedTransition(transition);
    setConfirmDialogOpen(true);
  };

  const handleConfirmTransition = async () => {
    if (!selectedTransition) return;

    setIsLoading(true);
    try {
      await apiClient.put(
        `/api/orders/${orderId}/status?status=${selectedTransition.to}&fulfillment_location=${fulfillmentLocation}`,
        {}
      );

      toast({
        title: "Status Updated",
        description: `Order ${orderNumber} is now ${selectedTransition.to}`,
      });

      onStatusChange();
      setConfirmDialogOpen(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not update order status. Please try again.";
      toast({
        variant: "destructive",
        title: "Failed to Update Status",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    setIsLoading(true);
    try {
      await apiClient.put(
        `/api/orders/${orderId}/status?status=cancelled&fulfillment_location=${fulfillmentLocation}`,
        {}
      );

      toast({
        title: "Order Cancelled",
        description: `Order ${orderNumber} has been cancelled`,
        variant: "destructive",
      });

      onStatusChange();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not cancel order. Please try again.";
      toast({
        variant: "destructive",
        title: "Failed to Cancel Order",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Next Status Transition Button */}
        {availableTransition && (
          <Button
            onClick={() => handleTransitionClick(availableTransition)}
            variant={availableTransition.variant}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <availableTransition.icon className="mr-2 h-4 w-4" />
            )}
            {availableTransition.label}
          </Button>
        )}

        {/* Cancel Order Button */}
        {currentStatus !== "delivered" && (
          <Button
            onClick={() => {
              setConfirmDialogOpen(true);
              setSelectedTransition({
                from: currentStatus,
                to: "cancelled",
                label: "Cancel Order",
                icon: XCircle,
                variant: "destructive",
              });
            }}
            variant="outline"
            disabled={isLoading}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Order
          </Button>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedTransition?.to === "cancelled"
                ? "Cancel Order"
                : "Confirm Status Change"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedTransition?.to === "cancelled" ? (
                <>
                  Are you sure you want to cancel order <strong>{orderNumber}</strong>?
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to change the status of order{" "}
                  <strong>{orderNumber}</strong> to <strong>{selectedTransition?.to}</strong>?
                </>
              )}

              {selectedTransition?.to === "confirmed" && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Select Fulfillment Location:</p>
                  <Select
                    value={fulfillmentLocation}
                    onValueChange={setFulfillmentLocation}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brisbane">Brisbane</SelectItem>
                      <SelectItem value="sydney">Sydney</SelectItem>
                      <SelectItem value="melbourne">Melbourne</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Stock will be deducted from this location
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={
                selectedTransition?.to === "cancelled"
                  ? handleCancelOrder
                  : handleConfirmTransition
              }
              disabled={isLoading}
              className={
                selectedTransition?.to === "cancelled"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
