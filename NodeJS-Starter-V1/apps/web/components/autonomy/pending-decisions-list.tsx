'use client';

/**
 * Pending Decisions List Component
 *
 * Displays all decisions that require human approval.
 * Allows filtering by agent and reviewing/approving decisions.
 */

import { useEffect, useState } from 'react';
import { Clock, Filter, RefreshCw } from 'lucide-react';
import {
  getPendingDecisions,
  formatConfidence,
  getRiskBadgeVariant,
} from '@/lib/api/autonomy';
import type { AgentDecision } from '@/lib/types/autonomy';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DecisionReviewDialog } from './decision-review-dialog';
import { formatDistanceToNow } from 'date-fns';

const KNOWN_AGENTS = {
  order_processing_agent: 'Order Processing',
  inventory_agent: 'Inventory Management',
  quote_agent: 'Quote Generation',
  forecasting_agent: 'Demand Forecasting',
  procurement_agent: 'Procurement',
  backorder_agent: 'Backorder Management',
  pricing_agent: 'Pricing Optimization',
  task_executor_agent: 'Task Execution',
};

export function PendingDecisionsList() {
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [filteredDecisions, setFilteredDecisions] = useState<AgentDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedDecision, setSelectedDecision] = useState<AgentDecision | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDecisions();
  }, []);

  useEffect(() => {
    if (selectedAgent === 'all') {
      setFilteredDecisions(decisions);
    } else {
      setFilteredDecisions(
        decisions.filter((d) => d.agent_id === selectedAgent)
      );
    }
  }, [selectedAgent, decisions]);

  const loadDecisions = async () => {
    try {
      setIsLoading(true);
      const pending = await getPendingDecisions(undefined, 100);
      setDecisions(pending);
      setFilteredDecisions(pending);
    } catch (error) {
      console.error('Failed to load pending decisions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending decisions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecisionClick = (decision: AgentDecision) => {
    setSelectedDecision(decision);
    setIsDialogOpen(true);
  };

  const handleDecisionResolved = () => {
    setIsDialogOpen(false);
    setSelectedDecision(null);
    loadDecisions();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
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
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {Object.entries(KNOWN_AGENTS).map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={loadDecisions}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredDecisions.length === 0
          ? 'No pending decisions'
          : `${filteredDecisions.length} decision${filteredDecisions.length === 1 ? '' : 's'} pending approval`}
      </div>

      {/* Decisions list */}
      {filteredDecisions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Pending Decisions</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {selectedAgent === 'all'
                ? 'All decisions have been reviewed. Check back later for new decisions requiring approval.'
                : 'This agent has no pending decisions. Try selecting a different agent or view all agents.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDecisions.map((decision) => {
            const agentName =
              KNOWN_AGENTS[decision.agent_id as keyof typeof KNOWN_AGENTS] ||
              decision.agent_id;
            const createdAt = new Date(decision.created_at);
            const expiresAt = decision.expires_at
              ? new Date(decision.expires_at)
              : null;

            return (
              <Card
                key={decision.decision_id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleDecisionClick(decision)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">
                        {decision.decision_type.replace(/_/g, ' ').toUpperCase()}
                      </CardTitle>
                      <CardDescription>{agentName}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getRiskBadgeVariant(decision.risk_level)}>
                        {decision.risk_level.toUpperCase()} RISK
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {formatConfidence(decision.confidence)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Context summary */}
                  {decision.context && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Context: </span>
                      <span>
                        {Object.entries(decision.context)
                          .slice(0, 3)
                          .map(([key, value]) => `${key}: ${value}`)
                          .join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Financial impact */}
                  {decision.estimated_value !== undefined && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">
                        Estimated Value:{' '}
                      </span>
                      <span className="font-medium">
                        ${decision.estimated_value.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {formatDistanceToNow(createdAt, { addSuffix: true })}
                    </div>
                    {expiresAt && (
                      <div>
                        Expires {formatDistanceToNow(expiresAt, { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedDecision && (
        <DecisionReviewDialog
          decision={selectedDecision}
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedDecision(null);
          }}
          onResolved={handleDecisionResolved}
        />
      )}
    </div>
  );
}
