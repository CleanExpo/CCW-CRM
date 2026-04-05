'use client';

import { memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

// PHASE 4 OPTIMIZATION: Memoized to prevent unnecessary re-renders
export const CategorySalesChart = memo(function CategorySalesChart({
  data,
}: CategorySalesChartProps) {
  // Transform data for recharts
  const chartData = (data || []).map((item, index) => ({
    category: item.category.replace(/_/g, ' '),
    value: parseFloat(item.value),
    percentage: item.percentage,
    color: COLORS[index % COLORS.length],
  }));

  // Custom tooltip to format currency and percentage
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { category: string; percentage: number }; value: number }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background rounded-lg border p-3 shadow-md">
          <p className="text-sm font-medium capitalize">{payload[0].payload.category}</p>
          <p className="text-primary text-sm font-bold">
            {new Intl.NumberFormat('en-AU', {
              style: 'currency',
              currency: 'AUD',
            }).format(payload[0].value)}
          </p>
          <p className="text-muted-foreground text-xs">
            {payload[0].payload.percentage.toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by Category</CardTitle>
        <CardDescription>Total sales distribution</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-muted-foreground flex h-[300px] items-center justify-center text-sm">
            No category data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="category"
                angle={-45}
                textAnchor="end"
                height={100}
                className="text-xs capitalize"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
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
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey="value" name="Sales" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
});
