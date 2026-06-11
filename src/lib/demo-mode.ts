/**
 * Demo-mode gate (UNI-2116).
 *
 * Mock/fixture data is ONLY allowed when this flag is explicitly enabled.
 * In production and staging the flag must be absent or "false"; falling back
 * to mock data silently is a production risk.
 *
 * Usage:
 *   import { isDemoMode } from '@/lib/demo-mode';
 *   if (isDemoMode()) { // render mock data }
 *
 * Enable:  NEXT_PUBLIC_DEMO_MODE=true  in .env.local
 * Disable: unset or NEXT_PUBLIC_DEMO_MODE=false  (default)
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}
