/**
 * Task Queue Page
 *
 * Submit tasks to the agentic layer and monitor their execution.
 */

import { Suspense } from 'react';
import { TaskSubmissionForm } from './components/TaskSubmissionForm';
import { TaskList } from './components/TaskList';
import { QueueStats } from './components/QueueStats';
import { TaskSLAPanel } from './components/TaskSLAPanel';

export const metadata = {
  title: 'Task Queue | Agentic Layer',
  description: 'Submit and monitor tasks for autonomous execution',
};

interface QueueStatsData {
  total_tasks: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
}

async function fetchQueueStats(): Promise<QueueStatsData> {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const res = await fetch(`${backendUrl}/api/tasks/stats/summary`, {
      cache: 'no-store',
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return {
        total_tasks: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
      };
    }

    return res.json();
  } catch (error) {
    console.error('Failed to fetch queue stats:', error);
    return {
      total_tasks: 0,
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    };
  }
}

export default async function TaskQueuePage() {
  const stats = await fetchQueueStats();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold">Task Queue</h1>
        <p className="text-gray-600">Submit tasks to the agentic layer for autonomous execution</p>
      </div>

      {/* Queue Stats */}
      <div className="mb-8">
        <QueueStats stats={stats} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Task Submission Form */}
        <div className="lg:col-span-1">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold">Submit New Task</h2>
            <TaskSubmissionForm />
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold">Task Queue</h2>
            <Suspense fallback={<TaskListSkeleton />}>
              <TaskList />
            </Suspense>
          </div>
          {/* SLA Deadlines Panel — UNI-174 ST-7 */}
          <TaskSLAPanel />
        </div>
      </div>
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg bg-white p-4 shadow">
          <div className="mb-2 h-4 w-2/3 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
