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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Order } from "../types";
import { OrderStatusTimeline } from "./OrderStatusTimeline";
import { OrderStatusActions } from "./OrderStatusActions";
import { OrderPrintView } from "./OrderPrintView";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/calculations";
import { Printer, FileText, AlertCircle, Ship, Calendar, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OrderDetailDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdate: () => void;
}

interface Backorder {
  id: string;
  product_id: string;
  quantity_backordered: number;
  quantity_fulfilled: number;
  quantity_remaining: number;
  status: string;
  expected_availability_date: string | null;
  container_id: string | null;
  is_overdue: boolean;
  days_until_available: number | null;
  product: {
    sku: string;
    name: string;
  } | null;
  container: {
    container_number: string;
    estimated_arrival_date: string | null;
  } | null;
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
  const [backorders, setBackorders] = useState<Backorder[]>([]);
  const [backordersLoading, setBackordersLoading] = useState(false);

  if (!order) return null;

  const loadBackorders = async () => {
    if (!order?.id) return;

    setBackordersLoading(true);
    try {
      const response = await apiClient.get<any>(`/api/backorders?order_id=${order.id}`);
      setBackorders(response.items || []);
    } catch (error: any) {
      console.error("Failed to load backorders:", error);
      toast({
        variant: "destructive",
        title: "Error loading backorders",
        description: error.message || "Failed to load backorder information",
      });
    } finally {
      setBackordersLoading(false);
    }
  };

  useEffect(() => {
    if (open && order?.id) {
      loadBackorders();
    }
  }, [open, order?.id]);

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
    router.push(`/orders/${order.id}/invoice`);
  };

  const items = order.items || order.order_items || [];

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

          {/* Customer Information */}
          <div>
            <h3 className="text-sm font-medium mb-2">Customer</h3>
            <p className="text-sm text-muted-foreground">
              {order.customer_name || "Unknown Customer"}
            </p>
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
                  {items.map((item: any, index: number) => (
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

          {/* Backorders Section */}
          {backordersLoading ? (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3">Backorders</h3>
                <Skeleton className="h-24 w-full" />
              </div>
            </>
          ) : backorders.length > 0 ? (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  Backorders ({backorders.length})
                </h3>
                <div className="space-y-3">
                  {backorders.map((backorder) => (
                    <div
                      key={backorder.id}
                      className={cn(
                        "rounded-lg border p-4 space-y-2",
                        backorder.is_overdue && "border-warning/50 bg-warning/5"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {backorder.product?.name || "Unknown Product"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            SKU: {backorder.product?.sku || "N/A"}
                          </p>
                        </div>
                        <Badge
                          variant={
                            backorder.status === "fulfilled"
                              ? "default"
                              : backorder.status === "allocated"
                              ? "outline"
                              : "secondary"
                          }
                          className="capitalize"
                        >
                          {backorder.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Backordered:</span>
                          <span className="ml-2 font-medium">{backorder.quantity_backordered}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Remaining:</span>
                          <span className="ml-2 font-medium">{backorder.quantity_remaining}</span>
                        </div>
                      </div>

                      {backorder.container && (
                        <div className="flex items-center gap-2 text-sm pt-2 border-t">
                          <Ship className="h-4 w-4 text-info" />
                          <span className="text-muted-foreground">Container:</span>
                          <span className="font-medium">{backorder.container.container_number}</span>
                          {backorder.expected_availability_date && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">
                                ETA: {format(new Date(backorder.expected_availability_date), "MMM dd, yyyy")}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {backorder.is_overdue && (
                        <div className="flex items-center gap-2 text-sm text-warning">
                          <AlertCircle className="h-4 w-4" />
                          <span>Overdue - Expected availability date has passed</span>
                        </div>
                      )}

                      {!backorder.is_overdue && backorder.days_until_available !== null && backorder.days_until_available >= 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>
                            Available in {backorder.days_until_available}{" "}
                            {backorder.days_until_available === 1 ? "day" : "days"}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

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
