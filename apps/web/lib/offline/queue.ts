/**
 * Failed Request Queue
 *
 * Stores failed API requests and retries them when connection is restored.
 */

import { onlineStatusDetector } from "./detector";

interface QueuedRequest {
  id: string;
  url: string;
  options: RequestInit;
  timestamp: number;
  retryCount: number;
}

const MAX_QUEUE_SIZE = 50;
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY = 2000; // 2 seconds

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;

  constructor() {
    // Listen for online status changes
    onlineStatusDetector.subscribe((isOnline) => {
      if (isOnline && this.queue.length > 0) {
        this.processQueue();
      }
    });

    // Load queue from localStorage on initialization
    this.loadQueue();
  }

  /**
   * Add failed request to queue
   */
  add(url: string, options: RequestInit): void {
    // Don't queue if already at max size
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      console.warn("[Request Queue] Queue is full, dropping oldest request");
      this.queue.shift();
    }

    const request: QueuedRequest = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      options,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(request);
    this.saveQueue();

    console.log(`[Request Queue] Added request to queue: ${url}`);
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && onlineStatusDetector.isOnline) {
      const request = this.queue[0];

      try {
        // Attempt to retry the request
        const response = await fetch(request.url, request.options);

        if (response.ok) {
          // Success - remove from queue
          this.queue.shift();
          this.saveQueue();
          console.log(`[Request Queue] Successfully retried: ${request.url}`);
        } else {
          // Failed - increment retry count
          request.retryCount++;

          if (request.retryCount >= MAX_RETRY_COUNT) {
            // Max retries exceeded - remove from queue
            this.queue.shift();
            this.saveQueue();
            console.error(`[Request Queue] Max retries exceeded: ${request.url}`);
          } else {
            // Wait before next retry
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          }
        }
      } catch (error) {
        // Network error - stop processing and wait for online event
        console.error(`[Request Queue] Retry failed:`, error);
        break;
      }
    }

    this.processing = false;
  }

  /**
   * Get queue size
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Clear all queued requests
   */
  clear(): void {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("request_queue", JSON.stringify(this.queue));
      } catch (error) {
        console.error("[Request Queue] Failed to save queue:", error);
      }
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("request_queue");
        if (saved) {
          this.queue = JSON.parse(saved);
        }
      } catch (error) {
        console.error("[Request Queue] Failed to load queue:", error);
      }
    }
  }
}

// Singleton instance
export const requestQueue = new RequestQueue();
