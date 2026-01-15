'use client';

/**
 * Agent Performance Dashboard Component
 *
 * Comprehensive dashboard showing:
 * - Agent performance statistics
 * - Learning analysis (confidence accuracy, risk accuracy)
 * - Threshold adjustment recommendations
 * - Historical trends
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  Lightbulb,
  BarChart3,
} from 'lucide-react';
import {
  listAgents,
  getAgentStats,
  getLearningAnalysis,
  getThresholdRecommendations,
  updateAgentConfig,
  formatConfidence,
} from '@/lib/api/autonomy';
import type {
  AgentSummary,
  AutonomyStats,
  LearningAnalysis,
  ThresholdRecommendations,
  ThresholdRecommendation,
} from '@/lib/types/autonomy';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

const TIME_PERIODS = [
  { value: 'last_24h', label: 'Last 24 Hours' },
  { value: 'last_7d', label: 'Last 7 Days' },
  { value: 'last_30d', label: 'Last 30 Days' },
] as const;

export function AgentPerformanceDashboard() {
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [timePeriod, setTimePeriod] = useState<'last_24h' | 'last_7d' | 'last_30d'>(
    'last_7d'
  );
  const [stats, setStats] = useState<AutonomyStats | null>(null);
  const [analysis, setAnalysis] = useState<LearningAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<ThresholdRecommendations | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingRecommendation, setIsApplyingRecommendation] = useState<string | null>(
    null
  );
  const { toast } = useToast();

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    // Check for agent parameter in URL
    const agentParam = searchParams?.get('agent');
    if (agentParam && agents.length > 0) {
      setSelectedAgentId(agentParam);
    } else if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].agent_id);
    }
  }, [searchParams, agents]);

  useEffect(() => {
    if (selectedAgentId) {
      loadAgentData();
    }
  }, [selectedAgentId, timePeriod]);

  const loadAgents = async () => {
    try {
      const response = await listAgents();
      setAgents(response.agents);
    } catch (error) {
      console.error('Failed to load agents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agents',
        variant: 'destructive',
      });
    }
  };

  const loadAgentData = async () => {
    if (!selectedAgentId) return;

    try {
      setIsLoading(true);

      // Load in parallel
      const [statsData, analysisData, recommendationsData] = await Promise.all([
        getAgentStats(selectedAgentId, timePeriod),
        getLearningAnalysis(selectedAgentId, timePeriod === 'last_24h' ? 1 : timePeriod === 'last_7d' ? 7 : 30),
        getThresholdRecommendations(selectedAgentId, timePeriod === 'last_24h' ? 7 : timePeriod === 'last_7d' ? 7 : 30),
      ]);

      setStats(statsData);
      setAnalysis(analysisData);
      setRecommendations(recommendationsData);
    } catch (error) {
      console.error('Failed to load agent data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agent performance data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyRecommendation = async (rec: ThresholdRecommendation) => {
    if (!selectedAgentId) return;

    try {
      setIsApplyingRecommendation(rec.parameter);

      // Build update object
      const updates: Record<string, any> = {
        [rec.parameter]:
          typeof rec.recommended_value === 'string'
            ? rec.recommended_value
            : rec.recommended_value,
      };

      await updateAgentConfig(selectedAgentId, updates);

      toast({
        title: 'Recommendation Applied',
        description: `Successfully updated ${rec.parameter}`,
      });

      // Reload data
      loadAgentData();
    } catch (error) {
      console.error('Failed to apply recommendation:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply recommendation',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingRecommendation(null);
    }
  };

  const selectedAgent = agents.find((a) => a.agent_id === selectedAgentId);

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No agents found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent selector and time period */}
      <div className="flex items-center gap-4">
        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select agent" />
          </SelectTrigger>
          <SelectContent>
            {agents.map((agent) => (
              <SelectItem key={agent.agent_id} value={agent.agent_id}>
                {agent.agent_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={timePeriod}
          onValueChange={(value: any) => setTimePeriod(value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_PERIODS.map((period) => (
              <SelectItem key={period.value} value={period.value}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Stats overview */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Decisions
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_decisions}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.pending} pending
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Auto-Execution Rate
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(stats.auto_execution_rate * 100).toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.auto_executed} auto-executed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Approval Rate
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(stats.approval_rate * 100).toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.approved} approved, {stats.rejected} rejected
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(stats.success_rate * 100).toFixed(0)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.success_count} successful
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabs for detailed views */}
          <Tabs defaultValue="analysis" className="space-y-4">
            <TabsList>
              <TabsTrigger value="analysis">Learning Analysis</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="space-y-4">
              {analysis && (
                <>
                  {/* Confidence Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Confidence Accuracy</CardTitle>
                      <CardDescription>
                        How well confidence scores predict outcomes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(analysis.confidence_analysis).map(
                          ([range, data]) => (
                            <div
                              key={range}
                              className="flex items-center justify-between rounded-lg border p-3"
                            >
                              <div className="space-y-1">
                                <div className="font-medium">{range}</div>
                                <div className="text-sm text-muted-foreground">
                                  {data.count} decisions • Avg confidence:{' '}
                                  {formatConfidence(data.avg_confidence)}
                                </div>
                              </div>
                              <div className="text-right">
                                {data.success_rate !== null && data.success_rate !== undefined ? (
                                  <div className="text-lg font-semibold">
                                    {(data.success_rate * 100).toFixed(0)}%
                                  </div>
                                ) : (
                                  <div className="text-sm text-muted-foreground">
                                    No outcomes yet
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Risk Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Risk Assessment Accuracy</CardTitle>
                      <CardDescription>
                        How well risk levels predict outcomes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(analysis.risk_analysis).map(
                          ([risk, data]) => (
                            <div
                              key={risk}
                              className="flex items-center justify-between rounded-lg border p-3"
                            >
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {risk.toUpperCase()} Risk
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {data.count} decisions
                                  {data.avg_value !== undefined &&
                                    ` • Avg value: $${data.avg_value.toLocaleString()}`}
                                </div>
                              </div>
                              <div className="text-right">
                                {data.success_rate !== null && data.success_rate !== undefined ? (
                                  <div className="text-lg font-semibold">
                                    {(data.success_rate * 100).toFixed(0)}%
                                  </div>
                                ) : (
                                  <div className="text-sm text-muted-foreground">
                                    No outcomes yet
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Human Override Patterns */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Human Override Patterns</CardTitle>
                      <CardDescription>
                        How often humans approve vs reject decisions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>Approved</span>
                          </div>
                          <span className="font-semibold">
                            {analysis.human_override_patterns.approved}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span>Rejected</span>
                          </div>
                          <span className="font-semibold">
                            {analysis.human_override_patterns.rejected}
                          </span>
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Approval Rate
                            </span>
                            <span className="text-lg font-semibold">
                              {(
                                analysis.human_override_patterns.approval_rate * 100
                              ).toFixed(0)}
                              %
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              {recommendations && recommendations.recommendations.length > 0 ? (
                <div className="space-y-4">
                  <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle>AI-Generated Recommendations</AlertTitle>
                    <AlertDescription>
                      Based on {recommendations.total_decisions_analyzed} decisions over{' '}
                      {recommendations.analysis_period_days} days
                    </AlertDescription>
                  </Alert>

                  {recommendations.recommendations.map((rec, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">
                              {rec.parameter.replace(/_/g, ' ').toUpperCase()}
                            </CardTitle>
                            <CardDescription>{rec.reason}</CardDescription>
                          </div>
                          <Badge
                            variant={
                              rec.confidence === 'high'
                                ? 'default'
                                : rec.confidence === 'medium'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {rec.confidence} confidence
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Current:</span>
                          <span className="font-medium">
                            {typeof rec.current_value === 'number'
                              ? rec.current_value
                              : rec.current_value}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Recommended:</span>
                          <span className="font-semibold text-green-600">
                            {typeof rec.recommended_value === 'number'
                              ? rec.recommended_value
                              : rec.recommended_value}
                          </span>
                        </div>
                        <Button
                          onClick={() => handleApplyRecommendation(rec)}
                          disabled={isApplyingRecommendation === rec.parameter}
                          className="w-full"
                        >
                          {isApplyingRecommendation === rec.parameter ? (
                            'Applying...'
                          ) : (
                            'Apply Recommendation'
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      No Recommendations Yet
                    </h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      Not enough data to generate recommendations. Continue using the
                      agent and check back after more decisions have been made.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
