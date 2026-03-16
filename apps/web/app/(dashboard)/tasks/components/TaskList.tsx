/**
 * TaskList Component
 *
 * Displays list of tasks in the queue with status and details.
 */

interface Task {
  id: string;
  status: string;
  task_type: string;
  priority: number;
  title: string;
  description: string;
  assigned_agent_type?: string;
  iterations: number;
  pr_url?: string;
  created_at: string;
}

async function fetchTasks(statusFilter?: string): Promise<{ tasks: Task[]; total: number }> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const url = statusFilter
      ? `${backendUrl}/api/tasks?status_filter=${statusFilter}&page_size=50`
      : `${backendUrl}/api/tasks?page_size=50`;

    const res = await fetch(url, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return { tasks: [], total: 0 };
    }

    return res.json();
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return { tasks: [], total: 0 };
  }
}

export async function TaskList() {
  const { tasks, total } = await fetchTasks();

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg bg-white p-12 text-center shadow">
        <div className="mb-3 text-gray-400">
          <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium text-gray-900">No tasks yet</h3>
        <p className="text-gray-600">Submit a task to get started with the agentic layer</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-4 text-sm text-gray-600">
        Showing {tasks.length} of {total} tasks
      </div>

      {tasks.map((task: Task) => {
        const statusConfig = {
          pending: { color: 'bg-yellow-100 text-yellow-800', icon: '[>]' },
          in_progress: { color: 'bg-blue-100 text-blue-800', icon: '[*]' },
          completed: { color: 'bg-green-100 text-green-800', icon: '[OK]' },
          failed: { color: 'bg-red-100 text-red-800', icon: '[X]' },
          cancelled: { color: 'bg-gray-100 text-gray-800', icon: '[-]' },
        };

        const config =
          statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;

        const typeColors = {
          feature: 'bg-blue-50 text-blue-700',
          bug: 'bg-red-50 text-red-700',
          refactor: 'bg-purple-50 text-purple-700',
          docs: 'bg-green-50 text-green-700',
          test: 'bg-orange-50 text-orange-700',
        };

        const typeColor =
          typeColors[task.task_type as keyof typeof typeColors] || 'bg-gray-50 text-gray-700';

        return (
          <div
            key={task.id}
            className="rounded-lg bg-white p-5 shadow-md transition hover:shadow-lg"
          >
            {/* Header */}
            <div className="mb-3 flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-2 flex items-center space-x-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${typeColor}`}>
                    {task.task_type}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${config.color}`}>
                    {config.icon} {task.status}
                  </span>
                  {task.priority <= 3 && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      High Priority
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{task.description}</p>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between border-t pt-3 text-xs text-gray-500">
              <div className="flex items-center space-x-4">
                {task.assigned_agent_type && (
                  <span className="flex items-center space-x-1">
                    <span className="font-medium">Agent:</span>
                    <span>{task.assigned_agent_type}</span>
                  </span>
                )}
                {task.iterations > 0 && <span>{task.iterations} iterations</span>}
                {task.pr_url && (
                  <a
                    href={task.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View PR
                  </a>
                )}
              </div>
              <div>Created {new Date(task.created_at).toLocaleString()}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
