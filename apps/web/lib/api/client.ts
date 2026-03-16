/**
 * API Client for FastAPI Backend
 *
 * Replaces Supabase client with direct fetch calls to FastAPI.
 * Handles JWT authentication via cookies.
 * Enhanced with retry logic, interceptors, and token refresh.
 */

import { withRetry, type RetryConfig } from "./retry";
import { interceptorManager } from "./interceptors";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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
 * Check if token is expired
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) return true;

    const exp = payload.exp as number;
    const now = Math.floor(Date.now() / 1000);

    // Consider token expired if less than 5 minutes remaining
    return exp - now < 300;
  } catch {
    return true;
  }
}

/**
 * Refresh token if needed
 */
async function refreshTokenIfNeeded(): Promise<void> {
  const token = getAuthToken();

  if (!token || !isTokenExpired(token)) {
    return; // Token is valid or doesn't exist
  }

  try {
    // Call refresh endpoint
    const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      // Refresh failed, redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  } catch (error) {
    console.error("Token refresh failed:", error);
  }
}

/**
 * Make an authenticated API request with retry logic and interceptors
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  retryConfig?: Partial<RetryConfig>
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BACKEND_URL}${endpoint}`;

  // Execute request interceptors
  await interceptorManager.executeRequest(url, options);

  try {
    // Refresh token if needed (before making request)
    await refreshTokenIfNeeded();

    // Make request with retry logic
    const response = await withRetry(async () => {
      const token = getAuthToken();

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;

        // Extract user_id from JWT and add to X-User-Id header (for auth middleware)
        const payload = decodeJWT(token);
        if (payload && payload.user_id) {
          headers["X-User-Id"] = payload.user_id;
        }
      }

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "include", // Include cookies
      });

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          detail: `HTTP ${response.status}: ${response.statusText}`,
        }));

        const apiError = new ApiClientError(
          error.detail,
          response.status,
          error.error_code
        );

        throw apiError;
      }

      return response;
    }, retryConfig);

    // Execute response interceptors
    await interceptorManager.executeResponse(url, response);

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  } catch (error: any) {
    // Execute error interceptors
    await interceptorManager.executeError(url, error);
    throw error;
  }
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
