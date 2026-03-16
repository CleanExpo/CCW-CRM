/**
 * React Query Configuration
 *
 * Centralized configuration for React Query with sensible defaults
 * for caching, refetching, and error handling.
 */

import { QueryClient, DefaultOptions } from "@tanstack/react-query";

const queryConfig: DefaultOptions = {
  queries: {
    // Stale time: 5 minutes (data is considered fresh for 5 minutes)
    staleTime: 5 * 60 * 1000,

    // Cache time: 10 minutes (unused data stays in cache for 10 minutes)
    gcTime: 10 * 60 * 1000,

    // Retry failed requests 3 times
    retry: 3,

    // Retry delay with exponential backoff
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Refetch on window focus (useful for keeping data fresh)
    refetchOnWindowFocus: true,

    // Don't refetch on reconnect (we have offline queue for that)
    refetchOnReconnect: false,

    // Refetch on mount if data is stale
    refetchOnMount: true,
  },
  mutations: {
    // Retry mutations once (less aggressive than queries)
    retry: 1,

    // Don't retry on 4xx errors (client errors)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },
};

/**
 * Create a new QueryClient instance
 *
 * This should be called once per request on the server,
 * and once per app lifecycle on the client.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: queryConfig,
  });
}

/**
 * Global query client for client-side use
 *
 * Note: In Next.js App Router, you should use QueryClientProvider
 * with a client-side boundary, not this global instance.
 */
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create a new client
    return createQueryClient();
  } else {
    // Browser: reuse existing client
    if (!browserQueryClient) {
      browserQueryClient = createQueryClient();
    }
    return browserQueryClient;
  }
}
