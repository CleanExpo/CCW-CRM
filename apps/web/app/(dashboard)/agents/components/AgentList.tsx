'use client';

import { useEffect, useState } from 'react';
import { agentsApi, type Agent } from '@/lib/api/agents';

export function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    agentsApi
      .listAgents()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, []);

  if (agents.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <div className="mb-2 text-gray-400">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="mb-1 text-lg font-medium text-gray-900">No agents yet</h3>
        <p className="text-gray-600">Agents will appear once tasks are executed</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent: Agent) => {
        const statusColor =
          agent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';

        const successRateColor =
          agent.success_rate > 0.85
            ? 'text-green-600'
            : agent.success_rate > 0.7
              ? 'text-yellow-600'
              : 'text-red-600';

        return (
          <div
            key={agent.agent_id}
            className="rounded-lg bg-white p-4 shadow transition hover:shadow-md"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <span className="text-sm font-semibold text-blue-600">
                    {agent.agent_type.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{agent.agent_type}</h3>
                  <p className="text-sm text-gray-500">{agent.agent_id.substring(0, 12)}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
                {agent.status}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-4 border-t pt-3">
              <div>
                <div className="text-xs text-gray-500">Tasks</div>
                <div className="text-lg font-semibold">{agent.task_count}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Success Rate</div>
                <div className={`text-lg font-semibold ${successRateColor}`}>
                  {(agent.success_rate * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
