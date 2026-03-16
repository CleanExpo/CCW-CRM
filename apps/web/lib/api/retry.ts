/**
 * Retry logic with exponential backoff
 *
 * Provides automatic retry for failed API requests with configurable
 * exponential backoff strategy.
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  retryableStatuses: number[];
  shouldRetry?: (error: any, attempt: number) => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 30% jitter
  return Math.min(exponentialDelay + jitter, config.maxDelay);
}

/**
 * Check if error is retryable
 */
function isRetryable(error: any, config: RetryConfig): boolean {
  // Network errors
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }

  // Rate limiting
  if (error.status === 429) {
    return true;
  }

  // Server errors
  if (config.retryableStatuses.includes(error.status)) {
    return true;
  }

  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry
      const shouldRetryCustom = retryConfig.shouldRetry?.(error, attempt);
      const shouldRetryDefault = isRetryable(error, retryConfig);

      if (attempt < retryConfig.maxRetries && (shouldRetryCustom ?? shouldRetryDefault)) {
        const delay = calculateDelay(attempt, retryConfig);

        // Log retry attempt (only in development)
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[Retry] Attempt ${attempt + 1}/${retryConfig.maxRetries} failed. ` +
              `Retrying in ${Math.round(delay)}ms...`,
            { error: error.message || error }
          );
        }

        await sleep(delay);
        continue;
      }

      // No more retries or not retryable
      throw error;
    }
  }

  throw lastError;
}

/**
 * Create a retry wrapper for fetch requests
 */
export function createRetryFetch(config?: Partial<RetryConfig>) {
  return async function retryFetch(
    url: string,
    options?: RequestInit
  ): Promise<Response> {
    return withRetry(() => fetch(url, options), config);
  };
}
