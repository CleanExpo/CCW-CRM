/**
 * Agent Autonomy Configuration Page
 *
 * Allows administrators to configure autonomy levels, confidence thresholds,
 * rate limits, and other settings for each AI agent.
 */

import { Metadata } from 'next';
import { AgentConfigList } from '@/components/autonomy/agent-config-list';

export const metadata: Metadata = {
  title: 'Agent Autonomy | CCW ERP',
  description: 'Configure AI agent autonomy levels and thresholds',
};

export default function AgentAutonomyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Autonomy</h1>
        <p className="text-muted-foreground mt-2">
          Configure how much autonomy each AI agent has to make decisions and execute actions.
        </p>
      </div>

      <AgentConfigList />
    </div>
  );
}
