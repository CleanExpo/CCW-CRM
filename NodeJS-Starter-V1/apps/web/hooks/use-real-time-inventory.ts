/**
 * Hook for real-time inventory updates via WebSocket.
 *
 * @example
 * ```tsx
 * useRealTimeInventory({
 *   onInventoryUpdate: (update) => {
 *     console.log('Stock changed:', update);
 *   }
 * });
 * ```
 */

"use client";

import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "@/contexts/websocket-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export interface InventoryUpdate {
  type: "inventory_update";
  product_id: string;
  warehouse: string;
  data: {
    product_id: string;
    product_name?: string;
    warehouse: string;
    available: number;
    reserved?: number;
  };
}

interface UseRealTimeInventoryOptions {
  showNotifications?: boolean;
  onInventoryUpdate?: (update: InventoryUpdate) => void;
}

export function useRealTimeInventory(options: UseRealTimeInventoryOptions = {}) {
  const { showNotifications = false, onInventoryUpdate } = options;

  const { subscribe, unsubscribe, connectionState } = useWebSocketContext();
  const router = useRouter();
  const { toast } = useToast();

  const handleInventoryUpdate = useCallback(
    (message: InventoryUpdate) => {
      if (message.type !== "inventory_update") return;

      router.refresh();
      onInventoryUpdate?.(message);

      if (showNotifications) {
        toast({
          title: "Inventory Updated",
          description: `${message.data.product_name || message.product_id} stock updated`,
          duration: 3000,
        });
      }
    },
    [onInventoryUpdate, showNotifications, router, toast]
  );

  useEffect(() => {
    if (connectionState !== "connected") return;

    subscribe("inventory", handleInventoryUpdate as any);

    return () => {
      unsubscribe("inventory");
    };
  }, [connectionState, subscribe, unsubscribe, handleInventoryUpdate]);

  return { connectionState };
}
