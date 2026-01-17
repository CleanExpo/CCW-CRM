"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Order, OrderActivity, OrderItem } from "../types";
import { OrderStatusTimeline } from "./OrderStatusTimeline";
import { OrderStatusActions } from "./OrderStatusActions";
import { OrderPrintView } from "./OrderPrintView";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/calculations";
import { apiClient } from "@/lib/api/client";
import { Printer, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface OrderDetailDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdate: () => void;
}

export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
  onOrderUpdate,
}: OrderDetailDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showPrintView, setShowPrintView] = useState(false);
  const [activity, setActivity] = useState<OrderActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [shippedDate, setShippedDate] = useState("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
  const [isTrackingSaving, setIsTrackingSaving] = useState(false);
  const orderId = order?.id;

  const handleStatusChange = () => {
    onOrderUpdate();
    onOpenChange(false);
  };

  const handlePrint = () => {
    setShowPrintView(true);
    // Wait for print view to render
    setTimeout(() => {
      window.print();
      setShowPrintView(false);
    }, 100);
  };

  const handleGenerateInvoice = () => {
    if (!orderId) {
      return;
    }
    router.push(`/orders/${orderId}/invoice`);
  };

  const handleSaveTracking = async () => {
    if (!order) return;
    setIsTrackingSaving(true);
    try {
      await apiClient.put(`/api/orders/${order.id}`, {
        tracking_number: trackingNumber || null,
        carrier_name: carrierName || null,
        shipped_date: shippedDate || null,
        estimated_delivery_date: estimatedDeliveryDate || null,
      });
      toast({
        title: "Fulfillment updated",
        description: "Tracking details saved.",
      });
      onOrderUpdate();
    } catch (error) {
      console.error("Failed to update tracking:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to save tracking details.",
      });
    } finally {
      setIsTrackingSaving(false);
    }
  };

  const formatEventType = (value: string) =>
    value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  useEffect(() => {
    if (!open || !orderId) return;
    let ignore = false;

    const loadActivity = async () => {
      setActivityLoading(true);
      setActivityError(null);
      try {
        const response = await apiClient.get<OrderActivity[]>(
          `/api/orders/${orderId}/activity`
        );
        if (!ignore) {
          setActivity(response);
        }
      } catch (error) {
        console.error("Failed to load order activity:", error);
        if (!ignore) {
          setActivityError("Unable to load activity timeline.");
        }
      } finally {
        if (!ignore) {
          setActivityLoading(false);
        }
      }
    };

    void loadActivity();
    return () => {
      ignore = true;
    };
  }, [open, orderId]);

  useEffect(() => {
    if (!order) return;
    setTrackingNumber(order.tracking_number ?? "");
    setCarrierName(order.carrier_name ?? "");
    setShippedDate(order.shipped_date ? order.shipped_date.split("T")[0] : "");
    setEstimatedDeliveryDate(
      order.estimated_delivery_date ? order.estimated_delivery_date.split("T")[0] : ""
    );
  }, [order]);

  if (!order) return null;

  const items: OrderItem[] = order.items || order.order_items || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl">Order {order.order_number}</DialogTitle>
                <DialogDescription>
                  Created {format(new Date(order.order_date), "MMMM dd, yyyy 'at' h:mm a")}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    order.status === "cancelled"
                      ? "destructive"
                      : order.status === "delivered"
                      ? "default"
                      : "outline"
                  }
                  className="capitalize"
                >
                  {order.status}
                </Badge>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleGenerateInvoice}>
                  <FileText className="h-4 w-4 mr-1" />
                  Invoice
                </Button>
              </div>
            </div>
          </DialogHeader>

        <div className="space-y-6">
          {/* Status Timeline */}
          <div>
            <h3 className="text-sm font-medium mb-4">Order Status</h3>
            <OrderStatusTimeline currentStatus={order.status} />
          </div>

          <Separator />

          {/* Quick Actions */}
          {order.status !== "delivered" && order.status !== "cancelled" && (
            <>
              <div>
                <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
                <OrderStatusActions
                  orderId={order.id}
                  currentStatus={order.status}
                  orderNumber={order.order_number}
                  onStatusChange={handleStatusChange}
                />
              </div>
              <Separator />
            </>
          )}

          {/* Activity Timeline */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">Activity</h3>
              <span className="text-xs text-muted-foreground">
                {activityLoading ? "Loading..." : `${activity.length} events`}
              </span>
            </div>
            {activityError ? (
              <p className="text-xs text-destructive">{activityError}</p>
            ) : activity.length ? (
              <div className="space-y-2">
                {activity.map((event) => (
                  <div key={event.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{formatEventType(event.event_type)}</Badge>
                        <span className="text-foreground">{event.message}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), "MMM dd, h:mm a")}
                      </span>
                    </div>
                    {event.created_by && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        By {event.created_by}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No activity recorded yet.
              </p>
            )}
          </div>

          <Separator />

          {/* Customer Information */}
          <div>
            <h3 className="text-sm font-medium mb-2">Customer</h3>
            <p className="text-sm text-muted-foreground">
              {order.customer_name || "Unknown Customer"}
            </p>
          </div>

          <Separator />

          {/* Fulfillment */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Fulfillment</h3>
              <span className="text-xs text-muted-foreground">
                Location: {order.fulfillment_location || "Unassigned"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tracking-number" className="text-xs uppercase tracking-widest text-muted-foreground">
                  Tracking number
                </Label>
                <Input
                  id="tracking-number"
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  placeholder="e.g. AU123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carrier-name" className="text-xs uppercase tracking-widest text-muted-foreground">
                  Carrier
                </Label>
                <Input
                  id="carrier-name"
                  value={carrierName}
                  onChange={(event) => setCarrierName(event.target.value)}
                  placeholder="e.g. AusPost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipped-date" className="text-xs uppercase tracking-widest text-muted-foreground">
                  Shipped date
                </Label>
                <Input
                  id="shipped-date"
                  type="date"
                  value={shippedDate}
                  onChange={(event) => setShippedDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated-delivery" className="text-xs uppercase tracking-widest text-muted-foreground">
                  Estimated delivery
                </Label>
                <Input
                  id="estimated-delivery"
                  type="date"
                  value={estimatedDeliveryDate}
                  onChange={(event) => setEstimatedDeliveryDate(event.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveTracking}
                disabled={isTrackingSaving}
              >
                {isTrackingSaving ? "Saving..." : "Save tracking"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div>
            <h3 className="text-sm font-medium mb-3">Order Items</h3>
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-xs font-medium">Product</th>
                    <th className="text-center p-3 text-xs font-medium">Quantity</th>
                    <th className="text-right p-3 text-xs font-medium">Unit Price</th>
                    <th className="text-right p-3 text-xs font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id || index} className="border-b last:border-b-0">
                      <td className="p-3 text-sm">
                        {item.product_name || item.product_id}
                      </td>
                      <td className="p-3 text-sm text-center">{item.quantity}</td>
                      <td className="p-3 text-sm text-right">
                        {formatCurrency(Number(item.unit_price))}
                      </td>
                      <td className="p-3 text-sm text-right font-medium">
                        {formatCurrency(Number(item.line_total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Totals */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(Number(order.total) / 1.1)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax (10% GST):</span>
                <span>{formatCurrency(Number(order.total) - Number(order.total) / 1.1)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total:</span>
                <span>{formatCurrency(Number(order.total))}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

      {/* Print View (Hidden, shown only during print) */}
      {showPrintView && <OrderPrintView order={order} />}
    </>
  );
}
