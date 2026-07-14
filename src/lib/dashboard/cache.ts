/**
 * In-memory LRU cache for dashboard data
 *
 * Provides a simple caching mechanism for expensive dashboard queries
 * with automatic cleanup to prevent memory leaks.
 */

class DashboardCache {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly defaultTTL = 60_000; // 60 seconds

  constructor() {
    // Clean up expired entries every 10 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now > value.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 10_000);
    this.cleanupInterval.unref?.();
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached data with optional TTL (defaults to 60 seconds)
   */
  set<T>(key: string, data: T, ttlMs: number = this.defaultTTL): void {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Destroy the cache and stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

export const dashboardCache = new DashboardCache();
