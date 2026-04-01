'use client';

import { useEffect, useState } from 'react';
import { agentsApi, type AgentTask } from '@/lib/api/agents';

interface TaskHistoryProps {
  limit?: number;
}

export function TaskHistory({ limit = 10 }: TaskHistoryProps) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);

  useEffect(() => {
    agentsApi
      .getRecentTasks(limit)
      .then(setTasks)
      .catch(() => setTasks([]));
  }, [limit]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <p className="text-gray-600">No recent task history</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white shadow">
      <div className="divide-y">
        {tasks.map((task) => {
          const statusColor =
            task.status === 'completed'
              ? 'bg-green-100 text-green-800'
              : task.status === 'failed'
                ? 'bg-red-100 text-red-800'
                : task.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800';

          return (
            <div key={task.task_id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {task.description || task.task_id.substring(0, 16)}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusColor}`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {task.agent_type} · {task.iterations} iteration
                    {task.iterations !== 1 ? 's' : ''}
                    {task.duration_seconds != null && ` · ${task.duration_seconds.toFixed(1)}s`}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-gray-400">
                  {new Date(task.created_at).toLocaleDateString('en-AU', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
