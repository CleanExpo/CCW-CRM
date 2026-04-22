'use client';

import { memo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import {
  chartAxisLine,
  chartGridStroke,
  chartLegendStyle,
  chartTickFill,
  DashboardWidgetEmpty,
  DashboardWidgetHeader,
} from '@/components/dashboard/dashboard-widget-primitives';

interface RevenueDataPoint {
  month: string;
  revenue: string;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

export const RevenueChart = memo(function RevenueChart({ data }: RevenueChartProps) {
  const chartData = (data || []).map((point) => ({
    month: point.month,
    revenue: parseFloat(point.revenue),
  }));

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { month: string }; value: number }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-white/15 bg-zinc-950/98 p-3 shadow-xl ring-1 ring-white/10 backdrop-blur-md">
          <p className="text-sm font-medium text-zinc-100">{payload[0].payload.month}</p>
          <p className="mt-1 text-sm font-bold text-sky-300">
            {new Intl.NumberFormat('en-AU', {
              style: 'currency',
              currency: 'AUD',
            }).format(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      <DashboardWidgetHeader
        title="Revenue trend"
        description="Last six months of delivered revenue (AUD)."
      />
      <div className="min-h-0 flex-1">
        {chartData.length === 0 ? (
          <DashboardWidgetEmpty
            icon={BarChart3}
            title="No revenue series yet"
            description="Once orders are marked delivered this month, a trend line will appear here. Use Presentation mode on the dashboard for a sample chart."
          />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: chartTickFill, fontSize: 12 }}
                axisLine={{ stroke: chartAxisLine }}
                tickLine={{ stroke: chartAxisLine }}
              />
              <YAxis
                tick={{ fill: chartTickFill, fontSize: 12 }}
                axisLine={{ stroke: chartAxisLine }}
                tickLine={{ stroke: chartAxisLine }}
                tickFormatter={(value) =>
                  new Intl.NumberFormat('en-AU', {
                    style: 'currency',
                    currency: 'AUD',
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(value)
                }
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={(props: any) => (
                  <CustomTooltip active={props.active} payload={props.payload} />
                )}
              />
              <Legend wrapperStyle={chartLegendStyle} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ fill: '#38bdf8', r: 4, stroke: '#0f172a', strokeWidth: 1 }}
                activeDot={{ r: 6, stroke: '#bae6fd', strokeWidth: 2 }}
                name="Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
