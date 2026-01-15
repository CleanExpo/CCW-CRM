'use client';

/**
 * Agent Configuration List Component
 *
 * Displays all agents with their current autonomy configurations.
 * Allows editing configuration via dialog.
 */

import { useEffect, useState } from 'react';
import { Settings, TrendingUp, Zap, ZapOff } from 'lucide-react';
import {
  listAgents,
  formatAutonomyLevel,
  getAgentStats,
} from '@/lib/api/autonomy';
import type { AgentSummary, AutonomyStats } from '@/lib/types/autonomy';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AgentConfigDialog } from './agent-config-dialog';

export function AgentConfigList() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [stats, setStats] = useState<Record<string, AutonomyStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      const response = await listAgents();
      setAgents(response.agents);

      // Load stats for each agent
      const statsPromises = response.agents.map(async (agent) => {
        try {
          const agentStats = await getAgentStats(agent.agent_id, 'last_7d');
          return { agentId: agent.agent_id, stats: agentStats };
        } catch (error) {
          console.error(`Failed to load stats for ${agent.agent_id}:`, error);
          return null;
        }
      });

      const statsResults = await Promise.all(statsPromises);
      const statsMap: Record<string, AutonomyStats> = {};
      statsResults.forEach((result) => {
        if (result) {
          statsMap[result.agentId] = result.stats;
        }
      });
      setStats(statsMap);
    } catch (error) {
      console.error('Failed to load agents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agent configurations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigClick = (agent: AgentSummary) => {
    setSelectedAgent(agent);
    setIsDialogOpen(true);
  };

  const handleConfigSaved = () => {
    setIsDialogOpen(false);
    setSelectedAgent(null);
    loadAgents();
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const agentStats = stats[agent.agent_id];
          const autoExecutionRate = agentStats
            ? (agentStats.auto_execution_rate * 100).toFixed(0)
            : '0';

          return (
            <Card key={agent.agent_id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{agent.agent_name}</CardTitle>
                    <CardDescription className="text-xs">
                      {agent.agent_id}
                    </CardDescription>
                  </div>
                  {agent.enabled ? (
                    <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <ZapOff className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Autonomy Level */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Autonomy</span>
                  <Badge variant="secondary">
                    {formatAutonomyLevel(agent.autonomy_level)}
                  </Badge>
                </div>

                {/* Stats */}
                {agentStats && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground">Decisions</div>
                      <div className="font-medium">{agentStats.total_decisions}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Auto-Execute</div>
                      <div className="font-medium">{autoExecutionRate}%</div>
                    </div>
                  </div>
                )}

                {/* Limits */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Amount:</span>
                    <span className="font-medium">
                      ${agent.max_auto_approval_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Hour:</span>
                    <span className="font-medium">{agent.max_actions_per_hour}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Per Day:</span>
                    <span className="font-medium">{agent.max_actions_per_day}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleConfigClick(agent)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Configure
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={`/agents/performance?agent=${agent.agent_id}`}>
                      <TrendingUp className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedAgent && (
        <AgentConfigDialog
          agentId={selectedAgent.agent_id}
          agentName={selectedAgent.agent_name}
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedAgent(null);
          }}
          onSaved={handleConfigSaved}
        />
      )}
    </>
  );
}
