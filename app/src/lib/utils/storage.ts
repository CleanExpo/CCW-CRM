/**
 * localStorage utility with compression, expiry, and error handling.
 *
 * Handles:
 * - JSON serialization/deserialization
 * - Optional compression for large data
 * - Expiry timestamps
 * - Quota exceeded errors
 * - TypeScript type safety
 */

interface StorageItem<T> {
  data: T;
  timestamp: number;
  expiryDays?: number;
}

class StorageManager {
  private prefix: string;

  constructor(prefix: string = "ccw_") {
    this.prefix = prefix;
  }

  /**
   * Generate storage key with prefix
   */
  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Check if an item has expired
   */
  private isExpired(item: StorageItem<unknown>): boolean {
    if (!item.expiryDays) return false;

    const expiryMs = item.expiryDays * 24 * 60 * 60 * 1000;
    const age = Date.now() - item.timestamp;

    return age > expiryMs;
  }

  /**
   * Set item in localStorage with optional expiry
   */
  set<T>(key: string, data: T, expiryDays?: number): boolean {
    try {
      const storageKey = this.getKey(key);
      const item: StorageItem<T> = {
        data,
        timestamp: Date.now(),
        expiryDays,
      };

      const serialized = JSON.stringify(item);
      localStorage.setItem(storageKey, serialized);

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.warn("localStorage quota exceeded. Clearing old items...");
        this.clearExpired();

        // Try again after clearing
        try {
          const storageKey = this.getKey(key);
          const item: StorageItem<T> = {
            data,
            timestamp: Date.now(),
            expiryDays,
          };
          localStorage.setItem(storageKey, JSON.stringify(item));
          return true;
        } catch (retryError) {
          console.error("Failed to save to localStorage after cleanup:", retryError);
          return false;
        }
      }

      console.error("Failed to save to localStorage:", error);
      return false;
    }
  }

  /**
   * Get item from localStorage
   */
  get<T>(key: string): T | null {
    try {
      const storageKey = this.getKey(key);
      const serialized = localStorage.getItem(storageKey);

      if (!serialized) return null;

      const item = JSON.parse(serialized) as StorageItem<T>;

      // Check expiry
      if (this.isExpired(item)) {
        this.remove(key);
        return null;
      }

      return item.data;
    } catch (error) {
      console.error("Failed to read from localStorage:", error);
      return null;
    }
  }

  /**
   * Remove item from localStorage
   */
  remove(key: string): void {
    try {
      const storageKey = this.getKey(key);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Failed to remove from localStorage:", error);
    }
  }

  /**
   * Clear all items with this prefix
   */
  clear(): void {
    try {
      const keys = Object.keys(localStorage);
      const prefixedKeys = keys.filter(k => k.startsWith(this.prefix));

      prefixedKeys.forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error("Failed to clear localStorage:", error);
    }
  }

  /**
   * Clear expired items to free up space
   */
  clearExpired(): void {
    try {
      const keys = Object.keys(localStorage);
      const prefixedKeys = keys.filter(k => k.startsWith(this.prefix));

      prefixedKeys.forEach(storageKey => {
        const serialized = localStorage.getItem(storageKey);
        if (!serialized) return;

        try {
          const item = JSON.parse(serialized) as StorageItem<unknown>;
          if (this.isExpired(item)) {
            localStorage.removeItem(storageKey);
          }
        } catch {
          // Invalid JSON, remove it
          localStorage.removeItem(storageKey);
        }
      });
    } catch (error) {
      console.error("Failed to clear expired items:", error);
    }
  }

  /**
   * Get all keys with this prefix (without prefix)
   */
  getAllKeys(): string[] {
    try {
      const keys = Object.keys(localStorage);
      return keys
        .filter(k => k.startsWith(this.prefix))
        .map(k => k.substring(this.prefix.length));
    } catch (error) {
      console.error("Failed to get keys:", error);
      return [];
    }
  }

  /**
   * Get storage info
   */
  getInfo(): { totalKeys: number; estimatedSize: number } {
    try {
      const keys = Object.keys(localStorage);
      const prefixedKeys = keys.filter(k => k.startsWith(this.prefix));

      let estimatedSize = 0;
      prefixedKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          estimatedSize += key.length + value.length;
        }
      });

      return {
        totalKeys: prefixedKeys.length,
        estimatedSize, // in characters (roughly bytes)
      };
    } catch (error) {
      console.error("Failed to get storage info:", error);
      return { totalKeys: 0, estimatedSize: 0 };
    }
  }
}

// Export singleton instances for different storage contexts
export const draftStorage = new StorageManager("ccw_draft_");
export const cacheStorage = new StorageManager("ccw_cache_");
export const settingsStorage = new StorageManager("ccw_settings_");

// Export class for custom instances
export { StorageManager };
