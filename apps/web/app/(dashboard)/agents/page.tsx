/**
 * Agent Dashboard Page
 *
 * Displays real-time agent metrics, task history, and performance trends.
 * Built with Next.js 15 Server Components for optimal performance.
 */

import { Suspense } from 'react';
import { AgentStats } from './components/AgentStats';
import { AgentList } from './components/AgentList';
import { TaskHistory } from './components/TaskHistory';
import { PerformanceTrends } from './components/PerformanceTrends';
import { LearningInsights } from './components/LearningInsights';

export const metadata = {
  title: 'Agent Dashboard | Agentic Layer',
  description: 'Monitor autonomous agent performance and metrics',
};

export default function AgentDashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold">Agent Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of the autonomous agentic layer
        </p>
      </div>

      {/* Overview Stats */}
      <div className="mb-8">
        <AgentStats />
      </div>

      {/* Main Content Grid */}
      <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Agent List */}
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Active Agents</h2>
          <Suspense fallback={<AgentListSkeleton />}>
            <AgentList />
          </Suspense>
        </div>

        {/* Recent Tasks */}
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Recent Tasks</h2>
          <Suspense fallback={<TaskHistorySkeleton />}>
            <TaskHistory limit={10} />
          </Suspense>
        </div>
      </div>

      {/* Performance Trends */}
      <div className="mb-8">
        <h2 className="mb-4 text-2xl font-semibold">Performance Trends</h2>
        <Suspense fallback={<PerformanceTrendsSkeleton />}>
          <PerformanceTrends days={7} />
        </Suspense>
      </div>

      {/* Learning Insights */}
      <div>
        <h2 className="mb-4 text-2xl font-semibold">Learning Insights</h2>
        <Suspense fallback={<LearningInsightsSkeleton />}>
          <LearningInsights />
        </Suspense>
      </div>
    </div>
  );
}

// Loading skeletons
function AgentListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-card animate-pulse rounded-lg p-4 shadow">
          <div className="bg-muted mb-2 h-4 w-1/3 rounded" />
          <div className="bg-muted h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

function TaskHistorySkeleton() {
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

function PerformanceTrendsSkeleton() {
  return (
    <div className="bg-card animate-pulse rounded-lg p-6 shadow">
      <div className="bg-muted h-64 rounded" />
    </div>
  );
}

function LearningInsightsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-card animate-pulse rounded-lg p-4 shadow">
          <div className="bg-muted mb-2 h-5 w-2/3 rounded" />
          <div className="bg-muted mb-2 h-4 w-full rounded" />
          <div className="bg-muted h-4 w-5/6 rounded" />
        </div>
      ))}
    </div>
  );
}
