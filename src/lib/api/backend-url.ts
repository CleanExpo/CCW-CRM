/**
 * API base URLs for the Next.js app (same-origin) vs optional legacy HTTP upstream.
 *
 * - Use `getAppOrigin()` for Route Handlers, server components, and the browser API client
 *   so `/api/*` hits this Next.js app.
 * - Set `API_UPSTREAM_URL` (or legacy `NEXT_PUBLIC_BACKEND_URL`) only if you still proxy
 *   some cron/integration traffic to an external service.
 */

export function getAppOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Optional external API base (no default). Used by legacy proxy routes only. */
export function getUpstreamApiBase(): string | null {
  const raw =
    process.env.API_UPSTREAM_URL?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/**
 * Base URL for server-side HTTP calls to domain APIs: optional upstream, otherwise this app.
 * Safe for orchestration jobs that call paths not implemented by the same Route Handler.
 */
export function getApiRequestBase(): string {
  return getUpstreamApiBase() ?? getAppOrigin();
}

/** @deprecated Use getAppOrigin() for same-origin Next.js APIs. */
export function getBackendUrl(): string {
  return getAppOrigin();
}
