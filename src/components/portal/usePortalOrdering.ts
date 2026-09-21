'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

/**
 * UNI-2747: whether online ordering is open for this customer. Asks the server
 * (a 409 means the gate is shut). Anything other than a clean answer is treated
 * as shut, so a failed check never shows ordering buttons.
 */
export function usePortalOrdering(): 'checking' | 'open' | 'shut' {
  const [state, setState] = useState<'checking' | 'open' | 'shut'>('checking');
  useEffect(() => {
    let live = true;
    apiClient
      .get('/api/portal/my-prices?page_size=1')
      .then(() => live && setState('open'))
      .catch(() => live && setState('shut'));
    return () => {
      live = false;
    };
  }, []);
  return state;
}
