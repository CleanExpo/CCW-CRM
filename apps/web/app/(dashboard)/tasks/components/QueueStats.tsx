'use client';

import { useEffect, useState } from 'react';
import { tasksApi, type TaskQueueStats } from '@/lib/api/tasks';

const FALLBACK: TaskQueueStats = {
  total_tasks: 0,
  pending: 0,
  in_progress: 0,
  completed: 0,
  failed: 0,
};

export function QueueStats() {
  const [stats, setStats] = useState<TaskQueueStats>(FALLBACK);

  useEffect(() => {
    tasksApi
      .getStatsSummary()
      .then(setStats)
      .catch(() => setStats(FALLBACK));
  }, []);

  const items = [
    { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
    { label: 'In Progress', value: stats.in_progress, color: 'text-blue-600' },
    { label: 'Completed', value: stats.completed, color: 'text-green-600' },
    { label: 'Failed', value: stats.failed, color: 'text-red-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-white p-4 text-center shadow">
          <div className={`text-3xl font-bold ${item.color}`}>{item.value}</div>
          <div className="mt-1 text-sm text-gray-600">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
