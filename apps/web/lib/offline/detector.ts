/**
 * Online/Offline Detection
 *
 * Detects network connectivity changes and notifies listeners.
 */

type OnlineStatusListener = (isOnline: boolean) => void;

class OnlineStatusDetector {
  private listeners: Set<OnlineStatusListener> = new Set();
  private _isOnline: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
    }
  }

  private handleOnline = () => {
    this._isOnline = true;
    this.notifyListeners();
  };

  private handleOffline = () => {
    this._isOnline = false;
    this.notifyListeners();
  };

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this._isOnline));
  }

  /**
   * Get current online status
   */
  get isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Subscribe to online status changes
   */
  subscribe(listener: OnlineStatusListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline);
      window.removeEventListener("offline", this.handleOffline);
    }
    this.listeners.clear();
  }
}

// Singleton instance
export const onlineStatusDetector = new OnlineStatusDetector();
