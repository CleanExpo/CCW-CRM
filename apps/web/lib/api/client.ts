/**
 * API Client for FastAPI Backend
 *
 * Replaces Supabase client with direct fetch calls to FastAPI.
 * Handles JWT authentication via cookies.
 * Includes simple TTL-based caching for GET requests.
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// Simple in-memory cache with TTL
const CACHE_TTL_MS = 30000; // 30 seconds
const cache = new Map<string, { data: unknown; timestamp: number }>();

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }
  // Clean up expired entry
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Clear cache for mutations (POST, PUT, PATCH, DELETE)
function invalidateCache(): void {
  cache.clear();
}

export interface ApiError {
  detail: string;
  error_code?: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorCode?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * Get JWT token from cookies (browser-side)
 */
function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split("; ");
  const tokenCookie = cookies.find((c) => c.startsWith("auth_token="));

  if (!tokenCookie) return null;

  return tokenCookie.split("=")[1];
}

/**
 * Make an authenticated API request
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BACKEND_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Include cookies
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      detail: `HTTP ${response.status}: ${response.statusText}`,
    }));

    throw new ApiClientError(
      error.detail,
      response.status,
      error.error_code
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * API Client - Browser-side
 * Includes caching for GET requests with automatic invalidation on mutations
 */
export const apiClient = {
  /**
   * GET request with caching
   * Uses TTL-based cache to avoid redundant requests
   */
  get: async <T>(endpoint: string, options?: RequestInit & { skipCache?: boolean }): Promise<T> => {
    const { skipCache, ...fetchOptions } = options || {};

    // Check cache first (unless explicitly skipped)
    if (!skipCache) {
      const cached = getCachedData<T>(endpoint);
      if (cached !== null) {
        return cached;
      }
    }

    // Fetch from server
    const data = await fetchApi<T>(endpoint, { ...fetchOptions, method: "GET" });

    // Cache the result
    setCachedData(endpoint, data);

    return data;
  },

  /**
   * POST request - invalidates cache
   */
  post: async <T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> => {
    const result = await fetchApi<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
    invalidateCache(); // Clear cache after mutation
    return result;
  },

  /**
   * PUT request - invalidates cache
   */
  put: async <T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> => {
    const result = await fetchApi<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
    invalidateCache(); // Clear cache after mutation
    return result;
  },

  /**
   * PATCH request - invalidates cache
   */
  patch: async <T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> => {
    const result = await fetchApi<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
    invalidateCache(); // Clear cache after mutation
    return result;
  },

  /**
   * DELETE request - invalidates cache
   */
  delete: async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    const result = await fetchApi<T>(endpoint, { ...options, method: "DELETE" });
    invalidateCache(); // Clear cache after mutation
    return result;
  },

  /**
   * Manually invalidate cache (useful after external changes)
   */
  invalidateCache,
};

/**
 * Create a browser client (for compatibility with existing code)
 */
export function createClient() {
  return apiClient;
}
