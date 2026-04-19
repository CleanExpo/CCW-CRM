'use client';

import { useEffect, useRef } from 'react';

import { apiClient } from '@/lib/api/client';

interface SecuritySettings {
  session_timeout_minutes: number;
}

const DEFAULT_TIMEOUT_MINUTES = 60;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'] as const;

async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // Swallow — we're about to redirect anyway.
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // Storage access can throw in some browsing modes — ignore.
    }
    window.location.href = '/login';
  }
}

/**
 * Idle-timeout watcher (UNI-1865).
 *
 * Loads `session_timeout_minutes` from /api/settings/security on mount and
 * arms a timer. Every user-activity event on the document resets the timer.
 * When the timer elapses, the hook calls the logout endpoint and redirects
 * to /login.
 */
export function useSessionTimeout(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutMinutes = DEFAULT_TIMEOUT_MINUTES;

    const reset = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(
        () => {
          void logout();
        },
        timeoutMinutes * 60 * 1000
      );
    };

    const arm = async () => {
      try {
        const settings = await apiClient.get<SecuritySettings>('/api/settings/security');
        if (cancelled) return;
        if (settings?.session_timeout_minutes && settings.session_timeout_minutes > 0) {
          timeoutMinutes = settings.session_timeout_minutes;
        }
      } catch {
        // Fall back to default if the endpoint is unreachable.
      }
      if (cancelled) return;

      reset();
      ACTIVITY_EVENTS.forEach((evt) => {
        document.addEventListener(evt, reset, { passive: true });
      });
    };

    void arm();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      ACTIVITY_EVENTS.forEach((evt) => {
        document.removeEventListener(evt, reset);
      });
    };
  }, []);
}
