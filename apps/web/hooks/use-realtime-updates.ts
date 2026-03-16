/**
 * Real-time Updates Hook
 *
 * React hook for subscribing to real-time updates via SSE or WebSocket.
 */

import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { sseClient, type SSEEventType, type SSEEvent } from "@/lib/realtime/sse-client";
import { productKeys, orderKeys, quoteKeys } from "@/lib/query/query-keys";
import { useToast } from "@/hooks/use-toast";

/**
 * Subscribe to inventory updates
 */
export function useInventoryUpdates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = sseClient.on<{ product_id: string; new_stock: number }>(
      "inventory_update",
      (event) => {
        console.log("[Real-time] Inventory update:", event.data);

        // Invalidate product queries to refetch
        queryClient.invalidateQueries({ queryKey: productKeys.all });
        queryClient.invalidateQueries({ queryKey: productKeys.detail(event.data.product_id) });

        // Show notification
        toast({
          title: "Inventory Updated",
          description: `Stock levels have been updated`,
        });
      }
    );

    return unsubscribe;
  }, [queryClient, toast]);
}

/**
 * Subscribe to order status changes
 */
export function useOrderStatusUpdates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = sseClient.on<{ order_id: string; new_status: string; order_number: string }>(
      "order_status_change",
      (event) => {
        console.log("[Real-time] Order status update:", event.data);

        // Invalidate order queries
        queryClient.invalidateQueries({ queryKey: orderKeys.all });
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(event.data.order_id) });

        // Show notification
        toast({
          title: "Order Status Updated",
          description: `Order ${event.data.order_number} is now ${event.data.new_status}`,
        });
      }
    );

    return unsubscribe;
  }, [queryClient, toast]);
}

/**
 * Subscribe to new orders
 */
export function useNewOrderNotifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = sseClient.on<{ order_id: string; order_number: string; customer_name: string }>(
      "new_order",
      (event) => {
        console.log("[Real-time] New order:", event.data);

        // Invalidate order queries
        queryClient.invalidateQueries({ queryKey: orderKeys.all });

        // Show notification
        toast({
          title: "New Order Received",
          description: `Order ${event.data.order_number} from ${event.data.customer_name}`,
        });
      }
    );

    return unsubscribe;
  }, [queryClient, toast]);
}

/**
 * Subscribe to quote updates
 */
export function useQuoteUpdates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = sseClient.on<{ quote_id: string; new_status: string; quote_number: string }>(
      "quote_update",
      (event) => {
        console.log("[Real-time] Quote update:", event.data);

        // Invalidate quote queries
        queryClient.invalidateQueries({ queryKey: quoteKeys.all });
        queryClient.invalidateQueries({ queryKey: quoteKeys.detail(event.data.quote_id) });

        // Show notification
        toast({
          title: "Quote Updated",
          description: `Quote ${event.data.quote_number} is now ${event.data.new_status}`,
        });
      }
    );

    return unsubscribe;
  }, [queryClient, toast]);
}

/**
 * Subscribe to all real-time updates
 */
export function useRealtimeUpdates() {
  useInventoryUpdates();
  useOrderStatusUpdates();
  useNewOrderNotifications();
  useQuoteUpdates();
}

/**
 * Hook to manually trigger SSE connection
 */
export function useSSEConnection() {
  const connect = useCallback(() => {
    if (!sseClient.isConnected) {
      // Get token from cookie if needed
      sseClient.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    sseClient.disconnect();
  }, []);

  useEffect(() => {
    // Auto-connect on mount
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connect,
    disconnect,
    isConnected: sseClient.isConnected,
  };
}
