"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RevenueDataPoint {
  month: string;
  revenue: string;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Transform data for recharts (convert revenue string to number)
  const chartData = data.map((point) => ({
    month: point.month,
    revenue: parseFloat(point.revenue),
  }));

  // Custom tooltip to format currency
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-brand-primary-200 bg-background p-3 shadow-lg dark:border-brand-primary-800">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {payload[0].payload.month}
          </p>
          <p className="text-base font-bold text-brand-primary-700 dark:text-brand-primary-400">
            {new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
            }).format(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Revenue Trend</CardTitle>
        <CardDescription>Last 6 months performance</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No revenue data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--brand-primary-600))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--brand-primary-600))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: "AUD",
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(value)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--brand-primary-600))"
                strokeWidth={2.5}
                fill="url(#revenueGradient)"
                dot={{ fill: "hsl(var(--brand-primary-600))", r: 4, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--brand-primary-600))" }}
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
