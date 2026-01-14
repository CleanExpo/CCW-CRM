/**
 * Agent Performance Dashboard Page
 *
 * Displays comprehensive performance metrics, learning analysis,
 * and recommendations for agent improvement.
 */

import { Metadata } from 'next';
import { AgentPerformanceDashboard } from '@/components/autonomy/agent-performance-dashboard';

export const metadata: Metadata = {
  title: 'Agent Performance | CCW ERP',
  description: 'View AI agent performance metrics and learning insights',
};

export default function AgentPerformancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Performance</h1>
        <p className="text-muted-foreground mt-2">
          Monitor agent performance, view learning insights, and apply recommended improvements.
        </p>
      </div>

      <AgentPerformanceDashboard />
    </div>
  );
}
