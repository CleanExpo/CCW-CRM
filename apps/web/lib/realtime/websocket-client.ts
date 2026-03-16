/**
 * WebSocket Client
 *
 * Manages WebSocket connections for bi-directional real-time communication.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const WS_URL = BACKEND_URL.replace(/^http/, "ws");

export type WSMessageType = "ping" | "pong" | "chat" | "notification" | "status_update";

export interface WSMessage<T = any> {
  type: WSMessageType;
  data: T;
  timestamp: string;
}

type WSMessageListener<T = any> = (message: WSMessage<T>) => void;

class WebSocketClient {
  private ws?: WebSocket;
  private listeners: Map<WSMessageType, Set<WSMessageListener>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval?: NodeJS.Timeout;

  /**
   * Connect to WebSocket endpoint
   */
  connect(token?: string): void {
    if (this.ws) {
      this.disconnect();
    }

    const url = new URL("/ws", WS_URL);
    if (token) {
      url.searchParams.append("token", token);
    }

    try {
      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        console.log("[WebSocket] Connected");
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.startPing();
      };

      this.ws.onclose = () => {
        console.log("[WebSocket] Disconnected");
        this.stopPing();
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };
    } catch (error) {
      console.error("[WebSocket] Failed to create connection:", error);
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WSMessage = JSON.parse(event.data);

      // Auto-respond to ping with pong
      if (message.type === "ping") {
        this.send("pong", {});
        return;
      }

      // Notify listeners
      const listeners = this.listeners.get(message.type);
      if (listeners) {
        listeners.forEach((listener) => listener(message));
      }
    } catch (error) {
      console.error("[WebSocket] Failed to parse message:", error);
    }
  }

  /**
   * Send message to server
   */
  send<T = any>(type: WSMessageType, data: T): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Cannot send message, not connected");
      return;
    }

    const message: WSMessage<T> = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send("ping", {});
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WebSocket] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Subscribe to a specific message type
   */
  on<T = any>(type: WSMessageType, listener: WSMessageListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(listener as WSMessageListener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.delete(listener as WSMessageListener);
      }
    };
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopPing();

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
      console.log("[WebSocket] Disconnected");
    }
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
