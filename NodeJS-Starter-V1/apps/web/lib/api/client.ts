/**
 * API Client for FastAPI Backend
 *
 * Replaces Supabase client with direct fetch calls to FastAPI.
 * Handles JWT authentication via cookies.
 */

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
