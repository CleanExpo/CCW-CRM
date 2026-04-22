'use client';

import { Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export const DASHBOARD_PRESENTATION_LS_KEY = 'ccw-dashboard-presentation';

type DashboardPresentationToggleProps = {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function DashboardPresentationToggle({
  checked,
  onCheckedChange,
  disabled,
  className,
}: DashboardPresentationToggleProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-zinc-950/40 to-black/40 p-4 shadow-lg shadow-black/20 ring-1 ring-white/[0.06] sm:flex-row sm:items-center sm:justify-between sm:gap-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/25 to-indigo-600/20 ring-1 ring-sky-500/25">
          <Sparkles className="h-4 w-4 text-sky-200" aria-hidden />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-white">Presentation mode</p>
          <p className="text-xs leading-relaxed text-zinc-400">
            Show polished sample KPIs and charts. Toggle off anytime for live data from your tenant.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:pl-2">
        <Switch
          id="dashboard-presentation-mode"
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-label="Toggle presentation mode with sample data"
        />
        <Label
          htmlFor="dashboard-presentation-mode"
          className="cursor-pointer text-xs font-medium text-zinc-300 sm:text-sm"
        >
          Sample data
        </Label>
      </div>
    </div>
  );
}
