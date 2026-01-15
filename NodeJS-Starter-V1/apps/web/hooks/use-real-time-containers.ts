/**
 * Hook for real-time container tracking updates via WebSocket.
 *
 * Containers are affected by status changes, ETA updates, and receiving operations.
 * This hook enables instant updates across all connected clients.
 *
 * @example
 * ```tsx
 * useRealTimeContainers({
 *   onContainerUpdate: () => {
 *     // Reload containers list
 *   }
 * });
 * ```
 */

"use client";

import { useEffect, useCallback } from "react";
import { useWebSocketContext } from "@/contexts/websocket-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export interface ContainerUpdate {
  type: "container_update";
  container_id: string;
  action: "created" | "updated" | "eta_updated" | "status_changed" | "arrived" | "received" | "deleted";
  data: {
    container_id: string;
    container_number?: string;
    status?: string;
    estimated_arrival_date?: string;
    actual_arrival_date?: string;
    days_until_arrival?: number;
  };
}

interface UseRealTimeContainersOptions {
  showNotifications?: boolean;
  onContainerUpdate?: (update: ContainerUpdate) => void;
}

export function useRealTimeContainers(options: UseRealTimeContainersOptions = {}) {
  const { showNotifications = true, onContainerUpdate } = options;

  const { subscribe, unsubscribe, connectionState } = useWebSocketContext();
  const router = useRouter();
  const { toast } = useToast();

  const handleContainerUpdate = useCallback(
    (message: ContainerUpdate) => {
      if (message.type !== "container_update") return;

      router.refresh();
      onContainerUpdate?.(message);

      if (showNotifications) {
        const actionLabel = {
          created: "Created",
          updated: "Updated",
          eta_updated: "ETA Updated",
          status_changed: "Status Changed",
          arrived: "Arrived",
          received: "Received",
          deleted: "Deleted",
        }[message.action] || "Updated";

        let description = message.data.container_number
          ? `Container ${message.data.container_number} ${actionLabel.toLowerCase()}`
          : `Container ${actionLabel.toLowerCase()}`;

        // Add ETA info for arriving containers
        if (message.action === "arrived" && message.data.actual_arrival_date) {
          description = `${message.data.container_number} has arrived at port`;
        } else if (message.action === "eta_updated" && message.data.days_until_arrival !== undefined) {
          description = `${message.data.container_number} ETA: ${message.data.days_until_arrival} days`;
        }

        toast({
          title: `Container ${actionLabel}`,
          description,
          duration: 3000,
        });
      }
    },
    [onContainerUpdate, showNotifications, router, toast]
  );

  useEffect(() => {
    if (connectionState !== "connected") return;

    subscribe("containers", handleContainerUpdate as any);

    return () => {
      unsubscribe("containers");
    };
  }, [connectionState, subscribe, unsubscribe, handleContainerUpdate]);

  return { connectionState };
}
