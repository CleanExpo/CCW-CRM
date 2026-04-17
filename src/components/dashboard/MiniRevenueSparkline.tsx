'use client';

import { memo, useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Point {
  month: string;
  revenue: string;
}

interface MiniRevenueSparklineProps {
  data: Point[];
}

/**
 * Compact trend strip for the performance card — reuses aggregated revenue series.
 */
export const MiniRevenueSparkline = memo(function MiniRevenueSparkline({
  data,
}: MiniRevenueSparklineProps) {
  const gradId = useId().replace(/:/g, '');
  const chartData = useMemo(
    () =>
      (data || []).map((p) => ({
        month: p.month,
        revenue: parseFloat(p.revenue) || 0,
      })),
    [data]
  );

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-6 text-center text-xs text-zinc-400">
        No trend data yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Revenue trajectory
      </p>
      <div className="h-[100px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-md border border-white/10 bg-zinc-950/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-sm">
                    <p className="font-medium text-foreground">{payload[0].payload.month}</p>
                    <p className="text-primary font-semibold tabular-nums">
                      {new Intl.NumberFormat('en-AU', {
                        style: 'currency',
                        currency: 'AUD',
                        maximumFractionDigits: 0,
                      }).format(Number(payload[0].value))}
                    </p>
                  </div>
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill={`url(#${gradId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
