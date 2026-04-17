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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RevenueDataPoint {
  month: string;
  revenue: string;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

// PHASE 4 OPTIMIZATION: Memoized to prevent unnecessary re-renders
export const RevenueChart = memo(function RevenueChart({ data }: RevenueChartProps) {
  // Transform data for recharts (convert revenue string to number)
  const chartData = (data || []).map((point) => ({
    month: point.month,
    revenue: parseFloat(point.revenue),
  }));

  // Custom tooltip to format currency
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { month: string }; value: number }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-white/10 bg-zinc-950/95 p-3 text-zinc-50 shadow-lg backdrop-blur-sm">
          <p className="text-sm font-medium">{payload[0].payload.month}</p>
          <p className="text-sm font-bold text-primary">
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
    <Card className="border-white/10 bg-zinc-950/40">
      <CardHeader>
        <CardTitle className="text-zinc-50">Revenue Trend</CardTitle>
        <CardDescription className="text-zinc-400">Last 6 months performance</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-zinc-400">
            No revenue data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tick={{ fill: '#a1a1aa' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: '#a1a1aa' }}
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
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
                name="Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
});
