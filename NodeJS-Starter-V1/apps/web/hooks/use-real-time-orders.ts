/**
 * Hook for real-time order updates via WebSocket.
 *
 * Subscribes to the 'orders' channel and updates local state
 * when orders are created, updated, or deleted.
 *
 * @example
 * ```tsx
 * const orders = useRealTimeOrders();
 *
 * // Orders will automatically update when changes occur
 * ```
 */

"use client";

import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "@/contexts/websocket-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export interface OrderUpdate {
  type: "order_update";
  action: "created" | "updated" | "status_changed" | "deleted";
  order_id: string;
  data: any;
}

interface UseRealTimeOrdersOptions {
  /** Show toast notifications for updates */
  showNotifications?: boolean;
  /** Callback when order is created */
  onOrderCreated?: (order: any) => void;
  /** Callback when order is updated */
  onOrderUpdated?: (order: any) => void;
  /** Callback when order is deleted */
  onOrderDeleted?: (orderId: string) => void;
  /** Callback when order status changes */
  onOrderStatusChanged?: (order: any) => void;
}

export function useRealTimeOrders(options: UseRealTimeOrdersOptions = {}) {
  const {
    showNotifications = true,
    onOrderCreated,
    onOrderUpdated,
    onOrderDeleted,
    onOrderStatusChanged,
  } = options;

  const { subscribe, unsubscribe, connectionState } = useWebSocketContext();
  const router = useRouter();
  const { toast } = useToast();

  const handleOrderUpdate = useCallback(
    (message: OrderUpdate) => {
      if (message.type !== "order_update") return;

      const { action, order_id, data } = message;

      // Refresh the page data
      router.refresh();

      // Handle specific actions
      switch (action) {
        case "created":
          onOrderCreated?.(data);
          if (showNotifications) {
            toast({
              title: "New Order",
              description: `Order ${data.order_number} has been created`,
              duration: 4000,
            });
          }
          break;

        case "updated":
          onOrderUpdated?.(data);
          if (showNotifications) {
            toast({
              title: "Order Updated",
              description: `Order ${data.order_number} has been updated`,
              duration: 3000,
            });
          }
          break;

        case "status_changed":
          onOrderStatusChanged?.(data);
          if (showNotifications) {
            toast({
              title: "Order Status Changed",
              description: `Order ${data.order_number} is now ${data.status}`,
              duration: 4000,
            });
          }
          break;

        case "deleted":
          onOrderDeleted?.(order_id);
          if (showNotifications) {
            toast({
              title: "Order Deleted",
              description: `Order has been removed`,
              variant: "destructive",
              duration: 3000,
            });
          }
          break;
      }
    },
    [onOrderCreated, onOrderUpdated, onOrderDeleted, onOrderStatusChanged, showNotifications, router, toast]
  );

  // Subscribe to orders channel
  useEffect(() => {
    if (connectionState !== "connected") return;

    subscribe("orders", handleOrderUpdate as any);

    return () => {
      unsubscribe("orders");
    };
  }, [connectionState, subscribe, unsubscribe, handleOrderUpdate]);

  return {
    connectionState,
  };
}
