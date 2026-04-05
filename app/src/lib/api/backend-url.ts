/**
 * Single source of truth for the backend API base URL.
 *
 * Usage: import { getBackendUrl } from "@/lib/api/backend-url";
 *
 * Precedence:
 *   1. NEXT_PUBLIC_BACKEND_URL (preferred, set this in Vercel)
 *   2. NEXT_PUBLIC_API_URL (legacy alias)
 *   3. http://localhost:8000 (local dev fallback)
 */

export function getBackendUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000"
  );
}

/** Pre-resolved URL for use in module-level constants. */
export const BACKEND_URL = getBackendUrl();
