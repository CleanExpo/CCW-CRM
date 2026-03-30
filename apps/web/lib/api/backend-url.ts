/**
 * Single source of truth for the FastAPI backend base URL.
 *
 * Resolution order:
 * 1. NEXT_PUBLIC_BACKEND_URL — set this in Vercel for production (Railway URL)
 * 2. BACKEND_URL             — server-only fallback (not available in edge runtime)
 * 3. http://localhost:8000   — local development default
 *
 * Usage:
 *   import { BACKEND_URL } from '@/lib/api/backend-url';
 *   const res = await fetch(`${BACKEND_URL}/api/products`);
 */
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  'http://localhost:8000';
