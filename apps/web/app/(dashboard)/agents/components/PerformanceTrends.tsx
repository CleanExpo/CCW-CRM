'use client';

import { useEffect, useState } from 'react';
import { agentsApi, type PerformanceTrends as PerformanceTrendsData } from '@/lib/api/agents';

interface PerformanceTrendsProps {
  days?: number;
}

export function PerformanceTrends({ days = 7 }: PerformanceTrendsProps) {
  const [trends, setTrends] = useState<PerformanceTrendsData | null>(null);

  useEffect(() => {
    agentsApi
      .getPerformanceTrends(days)
      .then(setTrends)
      .catch(() => setTrends(null));
  }, [days]);

  if (!trends || !trends.data_points) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <p className="text-gray-600">No trend data available</p>
      </div>
    );
  }

  const dataPoints = trends.data_points.slice(0, days).reverse();
  const maxTasks = Math.max(...dataPoints.map((d) => d.tasks_completed), 1);

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-6">
        <h3 className="mb-1 text-lg font-semibold">Last {days} Days</h3>
        <p className="text-sm text-gray-600">Task completion and success rate trends</p>
      </div>

      <div className="space-y-3">
        {dataPoints.map((point, idx) => {
          const barWidth = (point.tasks_completed / maxTasks) * 100;
          const successRateColor =
            point.success_rate > 0.85
              ? 'bg-green-500'
              : point.success_rate > 0.7
                ? 'bg-yellow-500'
                : 'bg-red-500';

          return (
            <div key={idx} className="flex items-center space-x-3">
              <div className="w-20 text-xs text-gray-500">
                {new Date(point.date).toLocaleDateString('en-AU', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
              <div className="relative flex-1">
                <div className="h-8 w-full rounded bg-gray-100">
                  <div
                    className="flex h-8 items-center justify-end rounded bg-blue-500 pr-2"
                    style={{ width: `${barWidth}%` }}
                  >
                    <span className="text-xs font-medium text-white">{point.tasks_completed}</span>
                  </div>
                </div>
              </div>
              <div className="w-16 text-right">
                <span className={`text-xs font-medium ${successRateColor.replace('bg-', 'text-')}`}>
                  {(point.success_rate * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <div className="h-3 w-3 rounded bg-blue-500" />
            <span>Tasks completed</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="h-3 w-3 rounded bg-green-500" />
            <span>&gt;85% success</span>
          </div>
        </div>
        <div>
          Avg: {(dataPoints.reduce((acc, d) => acc + d.tasks_completed, 0) / dataPoints.length) | 0}{' '}
          tasks/day
        </div>
      </div>
    </div>
  );
}
