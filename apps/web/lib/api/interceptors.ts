/**
 * Request/Response Interceptors for API Client
 *
 * Provides logging, metrics, and debugging capabilities for API requests.
 */

export interface RequestInterceptor {
  onRequest?: (url: string, options: RequestInit) => void | Promise<void>;
  onResponse?: (url: string, response: Response) => void | Promise<void>;
  onError?: (url: string, error: any) => void | Promise<void>;
}

class InterceptorManager {
  private interceptors: RequestInterceptor[] = [];

  /**
   * Add an interceptor
   */
  add(interceptor: RequestInterceptor): () => void {
    this.interceptors.push(interceptor);

    // Return unsubscribe function
    return () => {
      const index = this.interceptors.indexOf(interceptor);
      if (index > -1) {
        this.interceptors.splice(index, 1);
      }
    };
  }

  /**
   * Execute onRequest interceptors
   */
  async executeRequest(url: string, options: RequestInit): Promise<void> {
    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest) {
        await interceptor.onRequest(url, options);
      }
    }
  }

  /**
   * Execute onResponse interceptors
   */
  async executeResponse(url: string, response: Response): Promise<void> {
    for (const interceptor of this.interceptors) {
      if (interceptor.onResponse) {
        await interceptor.onResponse(url, response);
      }
    }
  }

  /**
   * Execute onError interceptors
   */
  async executeError(url: string, error: any): Promise<void> {
    for (const interceptor of this.interceptors) {
      if (interceptor.onError) {
        await interceptor.onError(url, error);
      }
    }
  }
}

export const interceptorManager = new InterceptorManager();

/**
 * Logging interceptor (development only)
 */
export const loggingInterceptor: RequestInterceptor = {
  onRequest: (url, options) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[API] ${options.method || "GET"} ${url}`, {
        headers: options.headers,
        body: options.body ? JSON.parse(options.body as string) : undefined,
      });
    }
  },
  onResponse: (url, response) => {
    if (process.env.NODE_ENV === "development") {
      const statusColor = response.ok ? "color: green" : "color: red";
      console.log(
        `[API] %c${response.status} ${url}`,
        statusColor,
        { ok: response.ok }
      );
    }
  },
  onError: (url, error) => {
    if (process.env.NODE_ENV === "development") {
      console.error(`[API] Error ${url}`, error);
    }
  },
};

/**
 * Performance metrics interceptor
 */
export const metricsInterceptor: RequestInterceptor = {
  onRequest: (url, options) => {
    const key = `api_${url}`;
    performance.mark(`${key}_start`);
  },
  onResponse: (url, response) => {
    const key = `api_${url}`;
    performance.mark(`${key}_end`);
    try {
      performance.measure(key, `${key}_start`, `${key}_end`);
      const measure = performance.getEntriesByName(key)[0];
      if (process.env.NODE_ENV === "development") {
        console.log(`[Metrics] ${url} took ${Math.round(measure.duration)}ms`);
      }
    } catch (e) {
      // Marks may not exist if request failed early
    }
  },
};

/**
 * Auto-register default interceptors in development
 */
if (process.env.NODE_ENV === "development") {
  interceptorManager.add(loggingInterceptor);
  interceptorManager.add(metricsInterceptor);
}
