import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Recharts / dashboard tokens for dark CRM shell */
export const chartGridStroke = 'rgba(255,255,255,0.07)';
export const chartAxisLine = 'rgba(255,255,255,0.12)';
export const chartTickFill = '#d4d4d8';
export const chartMutedFill = '#a3a3a3';
export const chartLegendStyle = { color: chartMutedFill, fontSize: 12, paddingTop: 16 };

export function DashboardWidgetHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 space-y-1.5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
      ) : null}
    </div>
  );
}

export function DashboardWidgetEmpty({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-zinc-950/55 px-5 py-10 text-center ring-1 ring-white/[0.04]',
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/25 to-indigo-600/20 ring-1 ring-sky-500/30">
        <Icon className="h-7 w-7 text-sky-100/90" aria-hidden />
      </div>
      <p className="text-base font-medium text-zinc-100">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">{description}</p>
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function DashboardWidgetLoading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-white/5 bg-white/[0.04] p-4">
            <div className="h-3 w-28 rounded bg-white/10" />
            <div className="mt-3 h-3 w-full rounded bg-white/[0.06]" />
            <div className="mt-2 h-3 max-w-md rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
    </div>
  );
}
