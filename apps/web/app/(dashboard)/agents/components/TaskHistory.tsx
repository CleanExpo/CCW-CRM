/**
 * TaskHistory Component
 *
 * Displays recent task executions with status and metrics.
 */

interface Task {
  task_id: string;
  status: string;
  description?: string;
  agent_type: string;
  verified: boolean;
  iterations: number;
  duration_seconds?: number;
  created_at: string;
}

interface TaskHistoryProps {
  limit?: number;
}

async function fetchRecentTasks(limit: number): Promise<Task[]> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const res = await fetch(`${backendUrl}/api/agents/tasks/recent?limit=${limit}`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return [];
    }

    return res.json();
  } catch (error) {
    console.error('Failed to fetch recent tasks:', error);
    return [];
  }
}

export async function TaskHistory({ limit = 10 }: TaskHistoryProps) {
  const tasks = await fetchRecentTasks(limit);

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <p className="text-gray-600">No recent tasks</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow">
      <div className="divide-y">
        {tasks.map((task: Task) => {
          const statusIcon =
            task.status === 'completed' ? '[OK]' : task.status === 'failed' ? '[X]' : '[>]';
          const statusColor =
            task.status === 'completed'
              ? 'text-green-600'
              : task.status === 'failed'
                ? 'text-red-600'
                : 'text-yellow-600';

          return (
            <div key={task.task_id} className="p-4 transition hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center space-x-2">
                    <span className={`font-bold ${statusColor}`}>{statusIcon}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {task.description || task.task_id}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span className="rounded bg-gray-100 px-2 py-1">{task.agent_type}</span>
                    {task.verified && <span className="font-medium text-green-600">Verified</span>}
                    <span>{task.iterations > 1 && `${task.iterations} iterations`}</span>
                    {task.duration_seconds && <span>{task.duration_seconds.toFixed(0)}s</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(task.created_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
