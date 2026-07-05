'use client';

import { useState, useEffect, memo } from 'react';
import { Activity, Package, Users, ShoppingCart, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCin7Stream, type Cin7SyncEvent } from '@/hooks/use-cin7-stream';
import { getCin7SyncHealth, type Cin7SyncHealth } from '@/lib/api/cin7';
import Link from 'next/link';
import {
  DashboardWidgetEmpty,
  DashboardWidgetHeader,
  DashboardWidgetLoading,
} from '@/components/dashboard/dashboard-widget-primitives';

const ENTITY_CONFIG: Record<string, { icon: typeof Package; color: string }> = {
  product: { icon: Package, color: 'text-sky-300' },
  customer: { icon: Users, color: 'text-emerald-300' },
  sales: { icon: ShoppingCart, color: 'text-violet-300' },
  inventory: { icon: Boxes, color: 'text-amber-300' },
};

const GRADE_BADGE: Record<string, string> = {
  A: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100',
  B: 'border-sky-500/40 bg-sky-500/15 text-sky-100',
  C: 'border-amber-500/40 bg-amber-500/15 text-amber-100',
  D: 'border-orange-500/40 bg-orange-500/15 text-orange-100',
  F: 'border-red-500/40 bg-red-500/15 text-red-100',
};

export const Cin7SyncStatusWidget = memo(function Cin7SyncStatusWidget() {
  const [health, setHealth] = useState<Cin7SyncHealth | null>(null);
  const [recentEvents, setRecentEvents] = useState<Cin7SyncEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: sseEvent, status: sseStatus } = useCin7Stream(true);

  useEffect(() => {
    async function fetchHealth() {
      try {
        setLoading(true);
        const healthData = await getCin7SyncHealth();
        setHealth(healthData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load sync health');
      } finally {
        setLoading(false);
      }
    }

    void fetchHealth();
  }, []);

  useEffect(() => {
    if (sseEvent) {
      setRecentEvents((prev) => [sseEvent, ...prev].slice(0, 10));
    }
  }, [sseEvent]);

  if (loading) {
    return <DashboardWidgetLoading title="Cin7 sync status" subtitle="Loading connector health…" />;
  }

  if (error) {
    return (
      <div>
        <DashboardWidgetHeader title="Cin7 sync status" description="Real-time sync activity and health." />
        <div className="rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <DashboardWidgetHeader
        title="Cin7 sync status"
        description="Live connector grade and recent sync events."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {sseStatus === 'connected' ? (
              <Badge variant="outline" className="border-emerald-500/30 text-xs text-emerald-200">
                <span className="mr-1.5 inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Live
              </Badge>
            ) : null}
            {health ? (
              <Badge
                variant="outline"
                className={`text-xs font-bold ${GRADE_BADGE[health.grade] ?? 'border-white/15 text-zinc-200'}`}
              >
                {health.grade} ({health.score})
              </Badge>
            ) : null}
            <Button asChild variant="outline" size="sm" className="border-white/15 text-zinc-200 hover:bg-white/10">
              <Link href="/dashboard/inventory/cin7">Verify data</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-white/15 text-zinc-200 hover:bg-white/10">
              <Link href="/dashboard/settings/integrations">Manage</Link>
            </Button>
          </div>
        }
      />

      {health ? (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-2 ring-1 ring-white/[0.04]">
            <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Success rate</p>
            <p className="mt-1 text-lg font-bold text-zinc-100 tabular-nums">{health.details.success_rate}%</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-2 ring-1 ring-white/[0.04]">
            <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Avg duration</p>
            <p className="mt-1 text-lg font-bold text-zinc-100 tabular-nums">
              {Math.round(health.details.avg_duration_ms)}ms
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-2 ring-1 ring-white/[0.04]">
            <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Total syncs</p>
            <p className="mt-1 text-lg font-bold text-zinc-100 tabular-nums">{health.details.total_syncs}</p>
          </div>
        </div>
      ) : null}

      {recentEvents.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Recent events</p>
          {recentEvents.slice(0, 5).map((event, idx) => {
            const config = ENTITY_CONFIG[event.entity_type] ?? {
              icon: Activity,
              color: 'text-zinc-400',
            };
            const Icon = config.icon;
            return (
              <div
                key={`${event.timestamp}-${idx}`}
                className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5 text-sm text-zinc-200"
              >
                <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                <span className="min-w-0 flex-1 truncate text-zinc-300">
                  {event.entity_type} {event.action}
                  {event.records_affected ? ` (${event.records_affected} records)` : ''}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <DashboardWidgetEmpty
          icon={Activity}
          title="No recent sync events"
          description="When Cin7 pushes inventory, customers, or sales data, a short trail of events will appear here for quick verification."
        />
      )}
    </div>
  );
});
