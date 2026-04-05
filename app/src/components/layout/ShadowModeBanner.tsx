'use client';

import { useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { shadowApi, type ShadowStatusResponse } from '@/lib/api/shadow';

export function ShadowModeBanner() {
  const [status, setStatus] = useState<ShadowStatusResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    shadowApi
      .getStatus()
      .then(setStatus)
      .catch(() => {
        // Shadow mode not available — fail silently
      });
  }, []);

  if (!status?.active || dismissed) return null;

  const { day_number, days_remaining, readiness_score } = status;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="font-medium">Shadow Mode Active</span>
        <span className="text-amber-600 dark:text-amber-500">—</span>
        <span>
          Day {day_number} of {day_number + days_remaining}
          {readiness_score !== null && (
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium">
              Readiness: {readiness_score}%
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="/settings/shadow"
          className="text-xs text-amber-700 underline transition-colors hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
        >
          View Dashboard
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 transition-colors hover:text-amber-900 dark:text-amber-500 dark:hover:text-amber-200"
          aria-label="Dismiss shadow mode banner"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
