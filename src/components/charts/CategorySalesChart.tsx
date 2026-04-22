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
import { LayoutGrid } from 'lucide-react';
import {
  chartAxisLine,
  chartGridStroke,
  chartLegendStyle,
  chartTickFill,
  DashboardWidgetEmpty,
  DashboardWidgetHeader,
} from '@/components/dashboard/dashboard-widget-primitives';

interface CategorySales {
  category: string;
  value: string;
  percentage: number;
}

interface CategorySalesChartProps {
  data: CategorySales[];
}

const BAR_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];

export const CategorySalesChart = memo(function CategorySalesChart({ data }: CategorySalesChartProps) {
  const chartData = (data || []).map((item, index) => ({
    category: item.category.replace(/_/g, ' '),
    value: parseFloat(item.value),
    percentage: item.percentage,
    fill: BAR_COLORS[index % BAR_COLORS.length],
  }));

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: { category: string; percentage: number }; value: number }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-white/15 bg-zinc-950/98 p-3 shadow-xl ring-1 ring-white/10 backdrop-blur-md">
          <p className="text-sm font-medium capitalize text-zinc-100">{payload[0].payload.category}</p>
          <p className="mt-1 text-sm font-bold text-sky-300">
            {new Intl.NumberFormat('en-AU', {
              style: 'currency',
              currency: 'AUD',
            }).format(payload[0].value)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{payload[0].payload.percentage.toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full min-h-[360px] flex-col">
      <DashboardWidgetHeader
        title="Sales by category"
        description="Distribution of sales value across product categories."
      />
      <div className="min-h-0 flex-1">
        {chartData.length === 0 ? (
          <DashboardWidgetEmpty
            icon={LayoutGrid}
            title="No category breakdown yet"
            description="Category mix appears when products have sales attributed to categories. Enable Presentation mode to preview sample bars."
          />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 56 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
              <XAxis
                dataKey="category"
                angle={-40}
                textAnchor="end"
                height={72}
                interval={0}
                tick={{ fill: chartTickFill, fontSize: 11 }}
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
              <Bar dataKey="value" name="Sales" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
