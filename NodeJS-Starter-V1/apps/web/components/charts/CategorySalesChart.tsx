"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CategorySales {
  category: string;
  value: string;
  percentage: number;
}

interface CategorySalesChartProps {
  data: CategorySales[];
}

// Premium color palette for categories
const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function CategorySalesChart({ data }: CategorySalesChartProps) {
  // Transform data for recharts
  const chartData = data.map((item, index) => ({
    category: item.category.replace(/_/g, " "),
    value: parseFloat(item.value),
    percentage: item.percentage,
    color: COLORS[index % COLORS.length],
  }));

  // Custom tooltip to format currency and percentage
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-brand-primary-200 bg-background p-3 shadow-lg dark:border-brand-primary-800">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 capitalize">
            {payload[0].payload.category}
          </p>
          <p className="text-base font-bold text-brand-primary-700 dark:text-brand-primary-400">
            {new Intl.NumberFormat("en-AU", {
              style: "currency",
              currency: "AUD",
            }).format(payload[0].value)}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
            <p className="text-xs font-medium text-muted-foreground">
              {payload[0].payload.percentage.toFixed(1)}% of total
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Sales by Category</CardTitle>
        <CardDescription>Total sales distribution</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No category data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
            >
              <defs>
                {chartData.map((entry, index) => (
                  <linearGradient key={`gradient-${index}`} id={`categoryGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={entry.color} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="category"
                angle={-45}
                textAnchor="end"
                height={100}
                className="text-xs capitalize"
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
              <Legend wrapperStyle={{ paddingTop: "10px" }} />
              <Bar dataKey="value" name="Sales" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#categoryGradient-${index})`} stroke={entry.color} strokeWidth={1.5} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
