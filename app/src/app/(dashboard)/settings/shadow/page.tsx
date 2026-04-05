'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Eye,
  RefreshCw,
  Download,
  Play,
  Square,
  TrendingUp,
  Database,
  Zap,
  Shield,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  shadowApi,
  type ShadowStatusResponse,
  type ReadinessScoreResponse,
  type AiOpportunity,
} from '@/lib/api/shadow';

function ScoreGauge({ score }: { score: number }) {
  const color =
    score >= 90
      ? 'text-green-600'
      : score >= 75
        ? 'text-emerald-500'
        : score >= 50
          ? 'text-amber-500'
          : 'text-red-500';

  const bgColor =
    score >= 90
      ? 'bg-green-100 dark:bg-green-950'
      : score >= 75
        ? 'bg-emerald-100 dark:bg-emerald-950'
        : score >= 50
          ? 'bg-amber-100 dark:bg-amber-950'
          : 'bg-red-100 dark:bg-red-950';

  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl ${bgColor} p-8`}>
      <span className={`text-6xl font-bold tabular-nums ${color}`}>{score}</span>
      <span className="text-muted-foreground mt-1 text-sm">/ 100</span>
      <span className="text-muted-foreground mt-2 text-xs font-medium tracking-wide uppercase">
        Readiness Score
      </span>
    </div>
  );
}

function BreakdownBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-muted-foreground text-xs">weight {weight}</p>
    </div>
  );
}

export default function ShadowModePage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ShadowStatusResponse | null>(null);
  const [readiness, setReadiness] = useState<ReadinessScoreResponse | null>(null);
  const [opportunities, setOpportunities] = useState<AiOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await shadowApi.getStatus();
      setStatus(s);

      if (s.active) {
        const [r, o] = await Promise.allSettled([
          shadowApi.getReadinessScore(),
          shadowApi.getAiOpportunities(),
        ]);
        if (r.status === 'fulfilled') setReadiness(r.value);
        if (o.status === 'fulfilled') setOpportunities(o.value.opportunities);
      }
    } catch (err: unknown) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStart() {
    setStarting(true);
    try {
      await shadowApi.startSession({ client_name: 'CCW Client', duration_days: 30 });
      toast({
        title: 'Shadow mode activated',
        description: 'Nightly syncs will begin tonight at 7 AM AEST.',
      });
      await load();
    } catch (err: unknown) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  }

  async function handleEnd() {
    if (!status?.session?.id) return;
    setEnding(true);
    try {
      await shadowApi.endSession(status.session.id);
      toast({ title: 'Shadow mode ended', description: 'Session marked complete.' });
      await load();
    } catch (err: unknown) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setEnding(false);
    }
  }

  async function handleDownloadReport() {
    setDownloading(true);
    try {
      const report = await shadowApi.getTransitionReport();
      const blob = new Blob([report.report_markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shadow-transition-report-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      toast({ title: 'Error', description: String(err), variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-32 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const session = status?.session;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Eye className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold">Shadow Mode</h1>
            <p className="text-muted-foreground text-sm">
              Parallel observation alongside the client&apos;s live system
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {status?.active ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadReport}
                disabled={downloading}
              >
                <Download className="mr-2 h-4 w-4" />
                {downloading ? 'Generating…' : 'Download Report'}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleEnd} disabled={ending}>
                <Square className="mr-2 h-4 w-4" />
                {ending ? 'Ending…' : 'End Shadow Mode'}
              </Button>
            </>
          ) : (
            <Button onClick={handleStart} disabled={starting}>
              <Play className="mr-2 h-4 w-4" />
              {starting ? 'Activating…' : 'Activate Shadow Mode'}
            </Button>
          )}
        </div>
      </div>

      {/* Status bar */}
      {status?.active && session ? (
        <>
          {/* Stats row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Current Day</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{session.day_number}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  {session.days_remaining} days remaining
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Syncs Completed</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{session.total_syncs_run}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  {session.successful_syncs} successful
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Products Observed</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {session.products_observed.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  {session.customers_observed.toLocaleString()} customers
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Invoices Observed</CardDescription>
                <CardTitle className="text-3xl tabular-nums">
                  {session.invoices_observed.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  {session.orders_observed.toLocaleString()} orders
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Readiness + Breakdown */}
          {readiness && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Transition Readiness</CardTitle>
                  <CardDescription>Composite score across 5 dimensions</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6">
                  <ScoreGauge score={readiness.score} />
                  <div className="bg-muted/30 w-full rounded-lg border p-4 text-sm">
                    <p className="mb-1 font-medium">Recommendation</p>
                    <p className="text-muted-foreground">{readiness.recommendation}</p>
                  </div>
                  {readiness.ready_for_transition && (
                    <Badge className="bg-green-500 text-white">Ready for Transition</Badge>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Score Breakdown</CardTitle>
                  <CardDescription>Performance across each readiness dimension</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <BreakdownBar
                    label="Data Completeness"
                    value={readiness.breakdown.data_completeness}
                    weight="25%"
                  />
                  <BreakdownBar
                    label="Sync Accuracy"
                    value={readiness.breakdown.sync_accuracy}
                    weight="25%"
                  />
                  <BreakdownBar
                    label="Workflow Coverage"
                    value={readiness.breakdown.workflow_match}
                    weight="20%"
                  />
                  <BreakdownBar
                    label="AI Confidence"
                    value={readiness.breakdown.ai_confidence}
                    weight="15%"
                  />
                  <BreakdownBar
                    label="Integration Health"
                    value={readiness.breakdown.integration_health}
                    weight="15%"
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Opportunities */}
          {opportunities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  AI Automation Opportunities
                </CardTitle>
                <CardDescription>
                  Ranked by confidence based on observed client workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {opportunities.map((opp) => (
                    <div key={opp.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                      <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums">
                        {opp.confidence}%
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{opp.title}</p>
                          <Badge variant="outline" className="text-xs">
                            {opp.domain}
                          </Badge>
                          <Badge
                            variant={opp.status === 'ready' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {opp.status === 'ready' ? 'Ready' : 'Needs Data'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">{opp.description}</p>
                        <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          ROI: {opp.estimated_roi}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        /* Inactive state */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <Eye className="text-muted-foreground/40 h-12 w-12" />
            <div>
              <h3 className="text-lg font-semibold">Shadow Mode is Inactive</h3>
              <p className="text-muted-foreground mt-1 max-w-md text-sm">
                Activate shadow mode to begin a 30-day parallel observation alongside the
                client&apos;s live system. Data syncs nightly from Cin7 and Xero.
              </p>
            </div>
            <div className="mt-2 grid w-full max-w-sm gap-3 text-left text-sm">
              {[
                { icon: Database, text: 'Nightly sync from Cin7 + Xero' },
                { icon: Activity, text: 'Workflow pattern observation' },
                { icon: TrendingUp, text: '30-day readiness score tracking' },
                { icon: Shield, text: "Zero impact on client's live system" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="text-muted-foreground flex items-center gap-2">
                  <Icon className="h-4 w-4 text-amber-500" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <Button className="mt-2" onClick={handleStart} disabled={starting}>
              <Play className="mr-2 h-4 w-4" />
              {starting ? 'Activating…' : 'Activate Shadow Mode'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
