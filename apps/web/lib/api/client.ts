/**
 * API Client for FastAPI Backend
 *
 * Replaces Supabase client with direct fetch calls to FastAPI.
 * Handles JWT authentication via cookies.
 *
 * Enhancements:
 * - X-Request-ID header for distributed tracing
 * - Automatic retry with exponential backoff on 5xx / network errors
 * - AbortController timeout (30s default)
 * - Automatic token refresh on 401
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Maximum number of retries for transient failures */
const MAX_RETRIES = 3;

/** Initial retry delay in milliseconds (doubles each attempt) */
const INITIAL_RETRY_DELAY_MS = 500;

/** HTTP methods that are safe to retry (idempotent) */
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

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
 * Get JWT token from localStorage or cookies (browser-side)
 * Tries localStorage first (more reliable for cross-port access), then falls back to cookies
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  // Try localStorage first (persistent "Keep me signed in")
  const localStorageToken = localStorage.getItem("auth_token");
  if (localStorageToken) return localStorageToken;

  // Try sessionStorage (session-only, clears on browser close)
  const sessionToken = sessionStorage.getItem("auth_token");
  if (sessionToken) return sessionToken;

  // Fallback to cookies (for backward compatibility)
  const cookies = document.cookie.split("; ");
  const tokenCookie = cookies.find((c) => c.startsWith("auth_token="));

  if (!tokenCookie) return null;

  return tokenCookie.split("=")[1];
}

/**
 * Decode JWT token to get payload (without verification)
 */
interface JWTPayload {
  user_id?: string;
  [key: string]: unknown;
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Attempt to refresh the JWT access token using the refresh endpoint.
 * Returns true if the token was successfully refreshed.
 */
async function attemptTokenRefresh(): Promise<boolean> {
  // Token refresh requires browser APIs (localStorage/sessionStorage)
  if (typeof window === "undefined") return false;

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      if (data.access_token) {
        // Store the new token in the same location as the original
        if (localStorage.getItem("auth_token")) {
          localStorage.setItem("auth_token", data.access_token);
        } else if (sessionStorage.getItem("auth_token")) {
          sessionStorage.setItem("auth_token", data.access_token);
        }
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Determine whether a failed request should be retried.
 */
function shouldRetry(
  method: string,
  status: number | null,
  retryCount: number
): boolean {
  if (retryCount >= MAX_RETRIES) return false;

  // Network error (status is null) — always retry
  if (status === null) return true;

  // Only retry idempotent methods on server errors
  if (status >= 500 && status < 600 && RETRYABLE_METHODS.has(method.toUpperCase())) {
    return true;
  }

  return false;
}

/**
 * Sleep for the exponential backoff delay.
 */
function retryDelay(attempt: number): Promise<void> {
  const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Make an authenticated API request with retry, timeout, and request tracing.
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const requestId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const method = (options.method || "GET").toUpperCase();

  const buildHeaders = (): HeadersInit => {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;

      const payload = decodeJWT(token);
      if (payload && payload.user_id) {
        headers["X-User-Id"] = payload.user_id;
      }
    }

    return headers;
  };

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BACKEND_URL}${endpoint}`;

  let lastError: ApiClientError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Wait before retry (skip on first attempt)
    if (attempt > 0) {
      await retryDelay(attempt - 1);
    }

    // Create a fresh AbortController for each attempt
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        method,
        headers: buildHeaders(),
        credentials: "include",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // --- 401 Unauthorized: attempt token refresh (once) ---
      if (response.status === 401 && attempt === 0) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
          // Retry immediately with the new token (counts as attempt 1)
          continue;
        }
      }

      // --- 5xx server error: maybe retry ---
      if (response.status >= 500 && shouldRetry(method, response.status, attempt)) {
        const error: ApiError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));
        lastError = new ApiClientError(error.detail, response.status, error.error_code);
        continue;
      }

      // --- Non-OK response: throw ---
      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));
        throw new ApiClientError(error.detail, response.status, error.error_code);
      }

      // --- 204 No Content ---
      if (response.status === 204) {
        return {} as T;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Timeout via AbortController (SSR-safe: DOMException may not exist in Node.js)
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        (error as { name: string }).name === "AbortError"
      ) {
        throw new ApiClientError(
          `Request timeout after ${timeout}ms [${requestId}]`,
          408,
          "REQUEST_TIMEOUT"
        );
      }

      // Already an ApiClientError (from non-OK handling above) — rethrow
      if (error instanceof ApiClientError) {
        throw error;
      }

      // Network error — retry if eligible
      if (shouldRetry(method, null, attempt)) {
        lastError = new ApiClientError(
          `Network error: ${(error as Error).message} [${requestId}]`,
          0,
          "NETWORK_ERROR"
        );
        continue;
      }

      // Exhausted retries or non-retryable
      throw new ApiClientError(
        `Network error: ${(error as Error).message} [${requestId}]`,
        0,
        "NETWORK_ERROR"
      );
    }
  }

  // If we exhausted retries, throw the last error
  throw lastError ?? new ApiClientError("Request failed after retries", 0, "RETRY_EXHAUSTED");
}

/**
 * API Client - Browser-side
 */
export const apiClient = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, options?: RequestInit) =>
    fetchApi<T>(endpoint, { ...options, method: "GET" }),

  /**
   * POST request
   */
  post: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  /**
   * PUT request
   */
  put: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  /**
   * PATCH request
   */
  patch: <T>(endpoint: string, data?: unknown, options?: RequestInit) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, options?: RequestInit) =>
    fetchApi<T>(endpoint, { ...options, method: "DELETE" }),
};

/**
 * Create a browser client (for compatibility with existing code)
 */
export function createClient() {
  return apiClient;
}
