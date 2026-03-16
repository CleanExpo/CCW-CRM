/**
 * Server-Sent Events (SSE) Client
 *
 * Manages SSE connections for real-time updates from the backend.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export type SSEEventType = "inventory_update" | "order_status_change" | "new_order" | "quote_update";

export interface SSEEvent<T = any> {
  type: SSEEventType;
  data: T;
  timestamp: string;
}

type SSEEventListener<T = any> = (event: SSEEvent<T>) => void;

class SSEClient {
  private eventSource?: EventSource;
  private listeners: Map<SSEEventType, Set<SSEEventListener>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second

  /**
   * Connect to SSE endpoint
   */
  connect(token?: string): void {
    if (this.eventSource) {
      this.disconnect();
    }

    const url = new URL("/api/events/stream", BACKEND_URL);
    if (token) {
      url.searchParams.append("token", token);
    }

    try {
      this.eventSource = new EventSource(url.toString());

      this.eventSource.onopen = () => {
        console.log("[SSE] Connected");
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.eventSource.onerror = (error) => {
        console.error("[SSE] Connection error:", error);
        this.handleReconnect();
      };

      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };

      // Listen for specific event types
      this.setupEventListeners();
    } catch (error) {
      console.error("[SSE] Failed to create EventSource:", error);
    }
  }

  /**
   * Setup listeners for specific event types
   */
  private setupEventListeners(): void {
    if (!this.eventSource) return;

    const eventTypes: SSEEventType[] = [
      "inventory_update",
      "order_status_change",
      "new_order",
      "quote_update",
    ];

    eventTypes.forEach((type) => {
      this.eventSource!.addEventListener(type, (event: MessageEvent) => {
        this.handleTypedEvent(type, event);
      });
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log("[SSE] Received message:", data);
    } catch (error) {
      console.error("[SSE] Failed to parse message:", error);
    }
  }

  /**
   * Handle typed events
   */
  private handleTypedEvent(type: SSEEventType, event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const sseEvent: SSEEvent = {
        type,
        data,
        timestamp: new Date().toISOString(),
      };

      // Notify all listeners for this event type
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.forEach((listener) => listener(sseEvent));
      }
    } catch (error) {
      console.error(`[SSE] Failed to parse ${type} event:`, error);
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[SSE] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Subscribe to a specific event type
   */
  on<T = any>(type: SSEEventType, listener: SSEEventListener<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(listener as SSEEventListener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(type);
      if (listeners) {
        listeners.delete(listener as SSEEventListener);
      }
    };
  }

  /**
   * Disconnect from SSE
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
      console.log("[SSE] Disconnected");
    }
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// Singleton instance
export const sseClient = new SSEClient();
