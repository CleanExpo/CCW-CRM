/**
 * WebSocket Context Provider
 *
 * Provides WebSocket connection and real-time updates throughout the app.
 * Automatically connects on mount and manages connection lifecycle.
 *
 * @example
 * ```tsx
 * // In app layout or root
 * <WebSocketProvider>
 *   <YourApp />
 * </WebSocketProvider>
 *
 * // In any component
 * const { subscribe, connectionState } = useWebSocketContext();
 * ```
 */

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useWebSocket, ConnectionState, WebSocketMessage } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";

interface WebSocketContextValue {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Subscribe to a channel with message handler */
  subscribe: (channel: string, handler: (message: WebSocketMessage) => void) => void;
  /** Unsubscribe from a channel */
  unsubscribe: (channel: string) => void;
  /** Send a message through WebSocket */
  sendMessage: (message: any) => void;
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Get last error */
  lastError: Error | null;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState<string>("");

  // Generate or retrieve client ID
  useEffect(() => {
    // Try to get existing client ID from localStorage
    let id = localStorage.getItem("ws_client_id");

    if (!id) {
      // Generate new client ID (you could also use user ID from auth)
      id = `client-${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem("ws_client_id", id);
    }

    setClientId(id);
  }, []);

  const wsHook = useWebSocket(clientId, {
    autoConnect: true,
    maxReconnectAttempts: 10,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
    heartbeatInterval: 30000,
    debug: process.env.NODE_ENV === "development",
  });

  const { connectionState, lastError } = wsHook;

  // Show notification on connection state changes
  useEffect(() => {
    if (connectionState === "connected") {
      toast({
        title: "Connected",
        description: "Real-time updates enabled",
        duration: 2000,
      });
    } else if (connectionState === "error" && lastError) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Real-time updates unavailable",
        duration: 3000,
      });
    }
  }, [connectionState, lastError, toast]);

  // Subscribe to notifications channel globally
  useEffect(() => {
    if (connectionState !== "connected") return;

    const handleNotification = (message: WebSocketMessage) => {
      if (message.type === "notification") {
        toast({
          title: message.title,
          description: message.message,
          variant: message.severity === "error" ? "destructive" : "default",
          duration: 5000,
        });
      }
    };

    wsHook.subscribe("notifications", handleNotification);

    return () => {
      wsHook.unsubscribe("notifications");
    };
  }, [connectionState, wsHook, toast]);

  if (!clientId) {
    // Don't render until we have a client ID
    return <>{children}</>;
  }

  return (
    <WebSocketContext.Provider value={wsHook}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to access WebSocket context.
 * Must be used within WebSocketProvider.
 */
export function useWebSocketContext() {
  const context = useContext(WebSocketContext);

  if (context === undefined) {
    throw new Error("useWebSocketContext must be used within WebSocketProvider");
  }

  return context;
}
