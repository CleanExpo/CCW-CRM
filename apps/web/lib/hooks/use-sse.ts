/**
 * PHASE 4: Server-Sent Events (SSE) Hook
 *
 * Subscribe to real-time updates via SSE with automatic reconnection.
 * Prevents overselling by receiving instant inventory updates.
 *
 * Usage:
 * ```tsx
 * const { data, status, error } = useSSE<InventoryUpdate>({
 *   url: '/api/inventory-stream',
 *   enabled: true,
 * });
 *
 * useEffect(() => {
 *   if (data) {
 *     console.log('Inventory update:', data);
 *     // Update UI
 *   }
 * }, [data]);
 * ```
 */

import { useEffect, useRef, useState, useCallback } from "react";

interface UseSSEOptions {
  /** SSE endpoint URL */
  url: string;

  /** Enable/disable connection (default: true) */
  enabled?: boolean;

  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;

  /** Reconnection delay in ms (default: 3000) */
  reconnectDelay?: number;

  /** Max reconnection attempts (default: 5, 0 = infinite) */
  maxReconnectAttempts?: number;

  /** Callback when connection opens */
  onOpen?: () => void;

  /** Callback when connection closes */
  onClose?: () => void;

  /** Callback when error occurs */
  onError?: (error: Event) => void;
}

interface UseSSEReturn<T> {
  /** Latest received data */
  data: T | null;

  /** Connection status */
  status: "connecting" | "connected" | "disconnected" | "error";

  /** Error message if status is "error" */
  error: string | null;

  /** Manually close connection */
  close: () => void;

  /** Manually reconnect */
  reconnect: () => void;

  /** Connection statistics */
  stats: {
    messagesReceived: number;
    reconnectAttempts: number;
    connectedAt: Date | null;
  };
}

export function useSSE<T = any>({
  url,
  enabled = true,
  autoReconnect = true,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5,
  onOpen,
  onClose,
  onError,
}: UseSSEOptions): UseSSEReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">(
    "disconnected"
  );
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    messagesReceived: 0,
    reconnectAttempts: 0,
    connectedAt: null as Date | null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyClosedRef = useRef(false);

  // Close connection
  const close = useCallback(() => {
    if (eventSourceRef.current) {
      isManuallyClosedRef.current = true;
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setStatus("disconnected");
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Connect to SSE
  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    try {
      isManuallyClosedRef.current = false;
      setStatus("connecting");
      setError(null);

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.addEventListener("connected", (event) => {
        setStatus("connected");
        setStats((prev) => ({
          ...prev,
          connectedAt: new Date(),
          reconnectAttempts: 0,
        }));
        onOpen?.();
      });

      // Message received
      eventSource.addEventListener("message", (event) => {
        try {
          const parsed = JSON.parse(event.data) as T;
          setData(parsed);
          setStats((prev) => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
          }));
        } catch (err) {
          console.error("Failed to parse SSE message:", err);
        }
      });

      // Heartbeat (keep-alive)
      eventSource.addEventListener("heartbeat", () => {
        // Silent heartbeat, just keeps connection alive
      });

      // Error occurred
      eventSource.onerror = (event) => {
        console.error("SSE error:", event);
        setStatus("error");
        setError("Connection error");

        // Close current connection
        eventSource.close();
        eventSourceRef.current = null;

        onError?.(event);

        // Auto-reconnect if enabled and not manually closed
        if (
          autoReconnect &&
          !isManuallyClosedRef.current &&
          (maxReconnectAttempts === 0 || stats.reconnectAttempts < maxReconnectAttempts)
        ) {
          setStats((prev) => ({
            ...prev,
            reconnectAttempts: prev.reconnectAttempts + 1,
          }));

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting to SSE... (attempt ${stats.reconnectAttempts + 1})`);
            connect();
          }, reconnectDelay);
        } else if (stats.reconnectAttempts >= maxReconnectAttempts && maxReconnectAttempts > 0) {
          setError(`Max reconnection attempts (${maxReconnectAttempts}) reached`);
        }
      };
    } catch (err) {
      console.error("Failed to create EventSource:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [
    enabled,
    url,
    autoReconnect,
    reconnectDelay,
    maxReconnectAttempts,
    stats.reconnectAttempts,
    onOpen,
    onError,
  ]);

  // Manually reconnect
  const reconnect = useCallback(() => {
    close();
    setStats((prev) => ({
      ...prev,
      reconnectAttempts: 0,
    }));
    setTimeout(connect, 100);
  }, [close, connect]);

  // Connect on mount or when dependencies change
  useEffect(() => {
    if (enabled) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      close();
    };
  }, [enabled, url]); // Only reconnect when URL or enabled changes

  return {
    data,
    status,
    error,
    close,
    reconnect,
    stats,
  };
}

/**
 * Example: Real-time inventory updates
 */
export interface InventoryUpdate {
  product_id: string;
  location: string;
  stock: number;
  reserved: number;
  available: number;
  change_type: "stock_update" | "reservation" | "transfer" | "adjustment";
}

/**
 * Hook for subscribing to inventory updates.
 */
export function useInventoryStream(location?: string) {
  const url = location ? `/api/inventory-stream?location=${location}` : "/api/inventory-stream";

  return useSSE<InventoryUpdate>({
    url,
    enabled: true,
    autoReconnect: true,
    reconnectDelay: 3000,
    maxReconnectAttempts: 5,
  });
}

/**
 * Example: Low stock alerts
 */
export interface LowStockAlert {
  product_id: string;
  product_name: string;
  location: string;
  stock: number;
  reorder_point: number;
  alert_type: "low_stock";
}

/**
 * Hook for subscribing to low stock alerts.
 */
export function useLowStockAlerts() {
  return useSSE<LowStockAlert>({
    url: "/api/inventory-alerts",
    enabled: true,
  });
}

/**
 * PHASE 4: Real-time order status updates
 */
export interface OrderStatusUpdate {
  type: "status_changed" | "fulfillment_updated" | "activity_added";
  order_id: string;
  order_number: string;
  previous_status?: string;
  new_status?: string;
  tracking_number?: string | null;
  carrier_name?: string | null;
  shipped_date?: string | null;
  estimated_delivery_date?: string | null;
}

/**
 * Hook for subscribing to order status updates.
 * Receives real-time notifications when orders change status or fulfillment updates.
 *
 * @param enabled - Enable/disable connection (default: true)
 */
export function useOrderStatusStream(enabled = true) {
  return useSSE<OrderStatusUpdate>({
    url: "/api/orders/status-stream",
    enabled,
    autoReconnect: true,
    reconnectDelay: 3000,
    maxReconnectAttempts: 5,
  });
}
