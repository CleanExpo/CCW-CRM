'use client';

import { useSessionTimeout } from '@/lib/hooks/useSessionTimeout';

/**
 * Thin client wrapper that arms the idle-timeout hook. Rendered once
 * inside the dashboard layout so every protected page benefits. Returns
 * null — the hook has the side effects.
 */
export function SessionTimeoutWatcher(): null {
  useSessionTimeout();
  return null;
}
