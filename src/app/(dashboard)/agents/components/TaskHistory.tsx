'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { agentsApi, type AgentTask } from '@/lib/api/agents';

interface TaskHistoryProps {
  limit?: number;
}

/**
 * UNI-2116: On API failure the component shows a visible error state instead
 * of silently setting tasks to an empty array (which looks like "no history").
 */
export function TaskHistory({ limit = 10 }: TaskHistoryProps) {
  const [tasks, setTasks] = useState<AgentTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    agentsApi
      .getRecentTasks(limit)
      .then((data) => {
        setTasks(data);
        setError(null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load task history';
        console.error('[UNI-2116] TaskHistory fetch failed:', message);
        setError(message);
        setTasks(null);
      });
  }, [limit]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">Task history unavailable</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (tasks === null) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card animate-pulse rounded-lg p-4 shadow">
            <div className="bg-muted mb-2 h-4 w-2/3 rounded" />
            <div className="bg-muted h-3 w-1/3 rounded" />
          </div>
        ))}
      </div>
    );
  }

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
