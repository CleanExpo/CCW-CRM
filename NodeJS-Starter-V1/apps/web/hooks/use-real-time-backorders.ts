/**
 * Hook for real-time backorder updates via WebSocket.
 *
 * Backorders are affected by both inventory changes (stock arriving) and
 * direct backorder operations (allocation, fulfillment, cancellation).
 *
 * @example
 * ```tsx
 * useRealTimeBackorders({
 *   onBackorderUpdate: () => {
 *     // Reload backorders list
 *   }
 * });
 * ```
 */

"use client";

import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "@/contexts/websocket-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export interface BackorderUpdate {
  type: "backorder_update";
  backorder_id: string;
  action: "created" | "updated" | "allocated" | "fulfilled" | "cancelled";
  data: {
    backorder_id: string;
    product_name?: string;
    customer_name?: string;
    status?: string;
    quantity_remaining?: number;
  };
}

interface UseRealTimeBackordersOptions {
  showNotifications?: boolean;
  onBackorderUpdate?: (update: BackorderUpdate) => void;
}

export function useRealTimeBackorders(options: UseRealTimeBackordersOptions = {}) {
  const { showNotifications = true, onBackorderUpdate } = options;

  const { subscribe, unsubscribe, connectionState } = useWebSocketContext();
  const router = useRouter();
  const { toast } = useToast();

  const handleBackorderUpdate = useCallback(
    (message: BackorderUpdate) => {
      if (message.type !== "backorder_update") return;

      router.refresh();
      onBackorderUpdate?.(message);

      if (showNotifications) {
        const actionLabel = {
          created: "Created",
          updated: "Updated",
          allocated: "Allocated",
          fulfilled: "Fulfilled",
          cancelled: "Cancelled",
        }[message.action] || "Updated";

        toast({
          title: `Backorder ${actionLabel}`,
          description: message.data.product_name
            ? `${message.data.product_name} backorder ${actionLabel.toLowerCase()}`
            : `Backorder ${actionLabel.toLowerCase()}`,
          duration: 3000,
        });
      }
    },
    [onBackorderUpdate, showNotifications, router, toast]
  );

  useEffect(() => {
    if (connectionState !== "connected") return;

    subscribe("backorders", handleBackorderUpdate as any);

    return () => {
      unsubscribe("backorders");
    };
  }, [connectionState, subscribe, unsubscribe, handleBackorderUpdate]);

  return { connectionState };
}
