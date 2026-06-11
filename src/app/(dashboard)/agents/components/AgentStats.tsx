'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { agentsApi, type AgentStats as AgentStatsData } from '@/lib/api/agents';

/**
 * UNI-2116: On API failure the component now shows a visible error state
 * instead of silently falling back to zeroed data.
 */
export function AgentStats() {
  const [stats, setStats] = useState<AgentStatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    agentsApi
      .getStats()
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load agent stats';
        console.error('[UNI-2116] AgentStats fetch failed:', message);
        setError(message);
        setStats(null);
      });
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">Agent stats unavailable</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    // Loading skeleton
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg border-l-4 border-l-gray-200 bg-white p-6 shadow-md">
            <div className="mb-2 h-3 w-24 rounded bg-gray-200" />
            <div className="h-8 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Active Agents',
      value: stats.active_agents,
      suffix: ` / ${stats.total_agents}`,
      color: 'blue',
    },
    {
      label: 'Success Rate',
      value: (stats.success_rate * 100).toFixed(1),
      suffix: '%',
      color: stats.success_rate > 0.8 ? 'green' : 'yellow',
    },
    {
      label: 'Total Tasks',
      value: stats.total_tasks,
      subtitle: `${stats.successful_tasks} successful`,
      color: 'purple',
    },
    {
      label: 'Avg Iterations',
      value: stats.avg_iterations.toFixed(1),
      subtitle: 'Self-corrections',
      color: stats.avg_iterations < 2 ? 'green' : 'orange',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border-l-4 bg-white p-6 shadow-md"
          style={{
            borderLeftColor:
              card.color === 'green'
                ? '#10b981'
                : card.color === 'blue'
                  ? '#3b82f6'
                  : card.color === 'purple'
                    ? '#8b5cf6'
                    : card.color === 'orange'
                      ? '#f59e0b'
                      : '#eab308',
          }}
        >
          <div className="mb-2 text-sm font-medium text-gray-600">{card.label}</div>
          <div className="text-3xl font-bold text-gray-900">
            {card.value}
            {card.suffix && <span className="text-lg text-gray-600">{card.suffix}</span>}
          </div>
          {'subtitle' in card && card.subtitle && (
            <div className="mt-1 text-sm text-gray-500">{card.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  );
}
