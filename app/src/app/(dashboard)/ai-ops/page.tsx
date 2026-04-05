'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────

interface ActionRecord {
  action_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  description: string;
  confidence: number;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface RunResponse {
  run_id: string;
  trigger: string;
  model: string;
  started_at: string;
  completed_at: string;
  actions_evaluated: number;
  actions_taken: number;
  actions: ActionRecord[];
  summary: string;
}

interface AuditLogResponse {
  total: number;
  runs: RunResponse[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create_draft_purchase_order: <ShoppingCart className="h-4 w-4" />,
  send_payment_reminder: <TrendingUp className="h-4 w-4" />,
  escalate_to_collections: <AlertTriangle className="h-4 w-4" />,
  flag_unmatched_transaction: <AlertTriangle className="h-4 w-4" />,
  notify_manager_sla_breach: <Clock className="h-4 w-4" />,
};

const ACTION_COLOURS: Record<string, string> = {
  create_draft_purchase_order: 'bg-blue-50 border-blue-200 text-blue-900',
  send_payment_reminder: 'bg-amber-50 border-amber-200 text-amber-900',
  escalate_to_collections: 'bg-red-50 border-red-200 text-red-900',
  flag_unmatched_transaction: 'bg-orange-50 border-orange-200 text-orange-900',
  notify_manager_sla_breach: 'bg-purple-50 border-purple-200 text-purple-900',
};

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  recommended: 'outline',
  approved: 'default',
  executed: 'default',
  rejected: 'destructive',
};

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const colour =
    pct >= 90
      ? 'text-green-700 bg-green-50'
      : pct >= 75
        ? 'text-amber-700 bg-amber-50'
        : 'text-red-700 bg-red-50';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colour}`}>{pct}% confidence</span>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────

function ActionCard({ action }: { action: ActionRecord }) {
  const colourClass =
    ACTION_COLOURS[action.action_type] || 'bg-gray-50 border-gray-200 text-gray-900';
  const icon = ACTION_ICONS[action.action_type] ?? <Zap className="h-4 w-4" />;

  return (
    <div className={`rounded-lg border p-4 ${colourClass}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{action.action_type.replace(/_/g, ' ')}</span>
            <Badge variant={STATUS_BADGE[action.status] ?? 'outline'}>{action.status}</Badge>
            <ConfidenceBadge value={action.confidence} />
          </div>
          <p className="text-sm leading-relaxed opacity-90">{action.description}</p>
          {Object.keys(action.metadata).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs opacity-70">
              {Object.entries(action.metadata)
                .slice(0, 4)
                .map(([k, v]) => (
                  <span key={k}>
                    <span className="font-medium">{k}:</span> {String(v)}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function AIOpsPage() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [loadingLog, setLoadingLog] = useState(false);
  const [latestRun, setLatestRun] = useState<RunResponse | null>(null);
  const [auditLog, setAuditLog] = useState<RunResponse[]>([]);
  const [activeTab, setActiveTab] = useState<'run' | 'log'>('run');

  async function handleRun() {
    setRunning(true);
    try {
      const result = await apiClient.post<RunResponse>('/api/ai/autonomous/run', {
        trigger: 'manual',
        dry_run: true,
      });
      setLatestRun(result);
      toast({
        title: 'Autonomous ops complete',
        description: result.summary,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Autonomous ops run failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  }

  async function loadAuditLog() {
    setLoadingLog(true);
    try {
      const result = await apiClient.get<AuditLogResponse>('/api/ai/autonomous/log?limit=20');
      setAuditLog(result.runs);
      setActiveTab('log');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not load log';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoadingLog(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Operations Centre</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Claude Sonnet 4.6 monitors your ERP and recommends autonomous actions — draft POs,
            payment reminders, transaction flags, and SLA escalations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadAuditLog} disabled={loadingLog}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingLog ? 'animate-spin' : ''}`} />
            Audit Log
          </Button>
          <Button onClick={handleRun} disabled={running} size="sm">
            <Play className={`mr-2 h-4 w-4 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Running...' : 'Run Now'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        {(['run', 'log'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary border-b-2'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'run' ? 'Latest Run' : 'Audit Log'}
          </button>
        ))}
      </div>

      {/* Latest Run */}
      {activeTab === 'run' && (
        <div className="space-y-4">
          {!latestRun ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Zap className="text-muted-foreground/40 mb-4 h-12 w-12" />
                <h3 className="font-semibold">No run yet</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Click &quot;Run Now&quot; to trigger an autonomous ERP evaluation.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary card */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Run Summary</CardTitle>
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Completed
                    </Badge>
                  </div>
                  <CardDescription>{latestRun.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">Model</p>
                      <p className="font-medium">{latestRun.model}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Trigger</p>
                      <p className="font-medium capitalize">{latestRun.trigger}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actions Evaluated</p>
                      <p className="font-medium">{latestRun.actions_evaluated}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actions Taken</p>
                      <p className="font-medium">{latestRun.actions_taken}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action cards */}
              <div className="space-y-3">
                <h2 className="text-muted-foreground text-sm font-semibold">RECOMMENDED ACTIONS</h2>
                {latestRun.actions.map((action) => (
                  <ActionCard key={action.action_id} action={action} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Audit Log */}
      {activeTab === 'log' && (
        <div className="space-y-4">
          {auditLog.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Clock className="text-muted-foreground/40 mb-4 h-12 w-12" />
                <h3 className="font-semibold">No history yet</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Run the agent to start building an audit trail.
                </p>
              </CardContent>
            </Card>
          ) : (
            auditLog.map((run) => (
              <Card key={run.run_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Run {run.run_id.slice(0, 8)}
                    </CardTitle>
                    <span className="text-muted-foreground text-xs">
                      {new Date(run.started_at).toLocaleString('en-AU')}
                    </span>
                  </div>
                  <CardDescription className="text-xs">{run.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground flex gap-4 text-xs">
                    <span>{run.actions_taken} actions</span>
                    <span>{run.model}</span>
                    <span className="capitalize">{run.trigger}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
