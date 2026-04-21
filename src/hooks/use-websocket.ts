/**
 * React Hook for WebSocket connections with automatic reconnection.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Channel subscription management
 * - Connection state tracking
 * - TypeScript support
 * - Error handling
 *
 * @example
 * ```tsx
 * const { subscribe, unsubscribe, sendMessage, connectionState } = useWebSocket('user-123');
 *
 * useEffect(() => {
 *   subscribe('orders', (message) => {
 *     console.log('Order update:', message);
 *   });
 *
 *   return () => unsubscribe('orders');
 * }, []);
 * ```
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketMessage {
  type: string;
  data?: unknown;
  channel?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface UseWebSocketOptions {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Reconnect attempts before giving up (default: 10) */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface UseWebSocketReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Subscribe to a channel with message handler */
  subscribe: (channel: string, handler: (message: WebSocketMessage) => void) => void;
  /** Unsubscribe from a channel */
  unsubscribe: (channel: string) => void;
  /** Send a message through WebSocket */
  sendMessage: (message: Record<string, unknown>) => void;
  /** Manually connect */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Get last error */
  lastError: Error | null;
}

/**
 * WebSocket hook with automatic reconnection and channel management.
 */
export function useWebSocket(
  clientId: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    autoConnect = true,
    maxReconnectAttempts = 10,
    reconnectDelay = 1000,
    maxReconnectDelay = 30000,
    heartbeatInterval = 30000,
    debug = false,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastError, setLastError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelHandlersRef = useRef<Map<string, Set<(message: WebSocketMessage) => void>>>(
    new Map()
  );

  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[WebSocket]', ...args);
      }
    },
    [debug]
  );

  const getWebSocketUrl = useCallback(() => {
    // Determine WebSocket protocol based on page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '') || 'localhost:3000';
    return `${protocol}//${host}/ws/${clientId}`;
  }, [clientId]);

  const sendMessage = useCallback(
    (message: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
        log('Sent message:', message);
      } else {
        log('Cannot send message: WebSocket not connected');
      }
    },
    [log]
  );

  const subscribe = useCallback(
    (channel: string, handler: (message: WebSocketMessage) => void) => {
      // Add handler to channel handlers map
      if (!channelHandlersRef.current.has(channel)) {
        channelHandlersRef.current.set(channel, new Set());
      }
      channelHandlersRef.current.get(channel)!.add(handler);

      // Send subscribe message to server
      sendMessage({
        action: 'subscribe',
        channel,
      });

      log(`Subscribed to channel: ${channel}`);
    },
    [sendMessage, log]
  );

  const unsubscribe = useCallback(
    (channel: string) => {
      // Remove all handlers for this channel
      channelHandlersRef.current.delete(channel);

      // Send unsubscribe message to server
      sendMessage({
        action: 'unsubscribe',
        channel,
      });

      log(`Unsubscribed from channel: ${channel}`);
    },
    [sendMessage, log]
  );

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping' });
        startHeartbeat();
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, sendMessage]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        log('Received message:', message);

        // Handle specific message types
        if (message.type === 'connection') {
          log('Connection confirmed:', message);
          return;
        }

        if (message.type === 'subscription') {
          log('Subscription confirmed:', message.channel, message.status);
          return;
        }

        // Route message to channel handlers
        if (message.channel) {
          const handlers = channelHandlersRef.current.get(message.channel);
          if (handlers) {
            handlers.forEach((handler) => {
              try {
                handler(message);
              } catch (error) {
                console.error(`Error in channel handler for ${message.channel}:`, error);
              }
            });
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    },
    [log]
  );

  const connect = useCallback(() => {
    // Don't reconnect if already connected or connecting
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    log('Connecting to WebSocket...');
    setConnectionState('connecting');

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        log('WebSocket connected');
        setConnectionState('connected');
        setLastError(null);
        reconnectAttemptsRef.current = 0;
        startHeartbeat();

        // Resubscribe to all channels
        channelHandlersRef.current.forEach((_, channel) => {
          sendMessage({
            action: 'subscribe',
            channel,
          });
        });
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        log('WebSocket error:', error);
        setLastError(new Error('WebSocket connection error'));
        setConnectionState('error');
      };

      ws.onclose = (event) => {
        log('WebSocket closed:', event.code, event.reason);
        setConnectionState('disconnected');
        stopHeartbeat();

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            reconnectDelay * Math.pow(2, reconnectAttemptsRef.current),
            maxReconnectDelay
          );

          log(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          log('Max reconnection attempts reached');
          setLastError(new Error('Failed to reconnect to WebSocket'));
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionState('error');
      setLastError(error as Error);
    }
  }, [
    getWebSocketUrl,
    handleMessage,
    log,
    maxReconnectAttempts,
    reconnectDelay,
    maxReconnectDelay,
    sendMessage,
    startHeartbeat,
    stopHeartbeat,
  ]);

  const disconnect = useCallback(() => {
    log('Disconnecting WebSocket...');

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionState('disconnected');
  }, [log, stopHeartbeat]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connect/disconnect/autoConnect are stable refs; adding them would cause infinite reconnect loops
  }, [clientId]); // Only reconnect if clientId changes

  return {
    connectionState,
    subscribe,
    unsubscribe,
    sendMessage,
    connect,
    disconnect,
    lastError,
  };
}
