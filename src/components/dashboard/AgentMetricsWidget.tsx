'use client';

import { memo } from 'react';
import Link from 'next/link';
import { Bot, AlertTriangle, CheckCircle2, XCircle, Activity, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAutonomyMetrics } from '@/hooks/use-autonomy-metrics';
import {
  DashboardWidgetEmpty,
  DashboardWidgetHeader,
  DashboardWidgetLoading,
} from '@/components/dashboard/dashboard-widget-primitives';

const STATUS_STYLES: Record<string, { label: string; badgeClass: string }> = {
  healthy: {
    label: 'Healthy',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100',
  },
  degraded: {
    label: 'Degraded',
    badgeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-100',
  },
  unhealthy: {
    label: 'Unhealthy',
    badgeClass: 'border-red-500/40 bg-red-500/15 text-red-100',
  },
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function isEndpointMissing(message: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('404') || m.includes('not found');
}

export const AgentMetricsWidget = memo(function AgentMetricsWidget() {
  const { metrics, health, anomalies, loading, error } = useAutonomyMetrics(24);

  if (loading) {
    return <DashboardWidgetLoading title="Agent performance" subtitle="Loading autonomy metrics…" />;
  }

  if (error && isEndpointMissing(error)) {
    return (
      <div className="flex h-full flex-col">
        <DashboardWidgetHeader
          title="Agent performance"
          description="Autonomous agent run metrics (merge, tests, duration)."
        />
        <DashboardWidgetEmpty
          icon={Bot}
          title="Agent analytics not enabled"
          description="This environment does not expose the autonomy metrics API yet, so live scores are unavailable. The rest of your dashboard still works normally."
        >
          <Button asChild variant="outline" size="sm" className="border-white/15 text-zinc-200 hover:bg-white/10">
            <Link href="/agents">Open agents</Link>
          </Button>
        </DashboardWidgetEmpty>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <DashboardWidgetHeader title="Agent performance" />
        <div className="rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[health?.status ?? 'healthy'] ?? STATUS_STYLES.healthy;

  return (
    <div className="flex h-full flex-col">
      <DashboardWidgetHeader
        title="Agent performance"
        description="Last 24 hours of autonomous agent activity."
        action={
          health ? (
            <Badge variant="outline" className={`text-xs font-semibold ${statusStyle.badgeClass}`}>
              {statusStyle.label}
            </Badge>
          ) : null
        }
      />

      {metrics && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-2 ring-1 ring-white/[0.04]">
              <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Success rate</p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  metrics.auto_merge_success_rate >= 0.9
                    ? 'text-emerald-300'
                    : metrics.auto_merge_success_rate >= 0.7
                      ? 'text-amber-300'
                      : 'text-red-300'
                }`}
              >
                {formatPercent(metrics.auto_merge_success_rate)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-2 ring-1 ring-white/[0.04]">
              <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Test pass</p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  metrics.test_pass_rate >= 0.95
                    ? 'text-emerald-300'
                    : metrics.test_pass_rate >= 0.8
                      ? 'text-amber-300'
                      : 'text-red-300'
                }`}
              >
                {formatPercent(metrics.test_pass_rate)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-2 ring-1 ring-white/[0.04]">
              <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">Avg duration</p>
              <p className="mt-1 text-lg font-bold text-zinc-100 tabular-nums">
                {formatDuration(metrics.avg_duration_ms)}
              </p>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Actions (24h)</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-zinc-300">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-zinc-500">Total</span>
                <span className="ml-auto font-medium tabular-nums text-zinc-100">{metrics.total_actions}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-zinc-500">Merged</span>
                <span className="ml-auto font-medium tabular-nums text-zinc-100">{metrics.total_auto_merged}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-zinc-500">Rejected</span>
                <span className="ml-auto font-medium tabular-nums text-zinc-100">{metrics.total_rejected}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-zinc-500">Blocked</span>
                <span className="ml-auto font-medium tabular-nums text-zinc-100">{metrics.total_blocked}</span>
              </div>
            </div>
          </div>

          {Object.keys(metrics.risk_distribution).length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Risk distribution</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(metrics.risk_distribution).map(([level, count]) => (
                  <Badge key={level} variant="secondary" className="border-white/10 bg-white/5 text-xs text-zinc-200">
                    {level}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {anomalies && anomalies.has_anomalies && (
        <div className="space-y-2 rounded-xl border border-red-500/25 bg-red-950/25 p-3 ring-1 ring-red-500/10">
          <p className="flex items-center gap-1 text-xs font-semibold tracking-wide text-red-200 uppercase">
            <AlertTriangle className="h-3.5 w-3.5" />
            Anomalies ({anomalies.anomaly_count})
          </p>
          <div className="space-y-1">
            {anomalies.anomalies.slice(0, 3).map((anomaly, idx) => (
              <p key={idx} className="truncate text-xs text-red-200/90">
                {anomaly}
              </p>
            ))}
          </div>
        </div>
      )}

      {metrics && metrics.total_actions === 0 && (
        <DashboardWidgetEmpty
          icon={Bot}
          title="No agent runs yet"
          description="When autonomous agents execute merges or checks, success rates and timings will show here."
        />
      )}
    </div>
  );
});
