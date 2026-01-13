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
import { Separator } from "@/components/ui/separator";
import { Order } from "../types";
import { OrderStatusTimeline } from "./OrderStatusTimeline";
import { OrderStatusActions } from "./OrderStatusActions";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils/calculations";

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
  if (!order) return null;

  const handleStatusChange = () => {
    onOrderUpdate();
    onOpenChange(false);
  };

  const items = order.items || order.order_items || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl">Order {order.order_number}</DialogTitle>
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
          </div>
          <DialogDescription>
            Created {format(new Date(order.order_date), "MMMM dd, yyyy 'at' h:mm a")}
          </DialogDescription>
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
  );
}
