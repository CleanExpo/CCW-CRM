'use client';

import { useEffect, useState } from 'react';
import { agentsApi, type AgentStats as AgentStatsData } from '@/lib/api/agents';

const FALLBACK: AgentStatsData = {
  total_agents: 0,
  active_agents: 0,
  total_tasks: 0,
  successful_tasks: 0,
  failed_tasks: 0,
  success_rate: 0,
  avg_iterations: 0,
  avg_duration_seconds: 0,
};

export function AgentStats() {
  const [stats, setStats] = useState<AgentStatsData>(FALLBACK);

  useEffect(() => {
    agentsApi
      .getStats()
      .then(setStats)
      .catch(() => setStats(FALLBACK));
  }, []);

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
