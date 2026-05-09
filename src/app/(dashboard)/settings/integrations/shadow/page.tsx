'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CheckCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getShadowStatus,
  getSyncGapsSummary,
  listSyncGaps,
  triggerShadowPoll,
  updateGapStatus,
  type Cin7GapSummaryItem,
  type Cin7ShadowStatus,
  type Cin7SyncGap,
} from '@/lib/api/cin7-shadow';
import {
  analyzeShadowGaps,
  autoResolveStaleShadowGaps,
  type ShadowAiAnalysis,
  type ShadowAiRecommendation,
} from '@/lib/api/cin7-shadow-ai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY_TYPES = [
  'product',
  'customer',
  'order',
  'quote',
  'supplier',
  'purchase_order',
] as const;

type EntityType = (typeof ENTITY_TYPES)[number];
type SeverityType = Cin7SyncGap['severity'];
type StatusType = Cin7SyncGap['status'];

// ---------------------------------------------------------------------------
// Demo fallback data
// ---------------------------------------------------------------------------

const DEMO_STATUS: Cin7ShadowStatus = {
  total_synced: 142,
  total_gaps: 8,
  total_conflicts: 2,
  last_poll_at: '2026-03-03T10:00:00Z',
  gap_by_entity: {
    product: 3,
    customer: 2,
    order: 2,
    supplier: 1,
  },
};

const DEMO_SUMMARY: Cin7GapSummaryItem[] = [
  { entity_type: 'product', severity: 'critical', count: 1 },
  { entity_type: 'product', severity: 'high', count: 2 },
  { entity_type: 'customer', severity: 'medium', count: 2 },
  { entity_type: 'order', severity: 'high', count: 1 },
  { entity_type: 'order', severity: 'low', count: 1 },
  { entity_type: 'supplier', severity: 'medium', count: 1 },
];

const DEMO_GAPS: Cin7SyncGap[] = [
  {
    id: 'demo-gap-1',
    shadow_sync_id: 'demo-shadow-1',
    gap_type: 'missing_in_erp',
    entity_type: 'product',
    cin7_id: 'PROD-CIN7-1001',
    erp_id: null,
    field_name: null,
    cin7_value: null,
    erp_value: null,
    severity: 'critical',
    status: 'open',
    detected_at: new Date(Date.now() - 7200000).toISOString(),
    resolved_at: null,
    resolution_notes: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'demo-gap-2',
    shadow_sync_id: 'demo-shadow-2',
    gap_type: 'data_mismatch',
    entity_type: 'customer',
    cin7_id: 'CUST-CIN7-2042',
    erp_id: '00000000-0000-0000-0000-000000000001',
    field_name: 'email',
    cin7_value: 'contact@acme.cin7.com',
    erp_value: 'old-contact@acme.local',
    severity: 'medium',
    status: 'investigating',
    detected_at: new Date(Date.now() - 18000000).toISOString(),
    resolved_at: null,
    resolution_notes: 'Awaiting customer confirmation',
    created_at: new Date(Date.now() - 18000000).toISOString(),
  },
  {
    id: 'demo-gap-3',
    shadow_sync_id: 'demo-shadow-3',
    gap_type: 'missing_in_erp',
    entity_type: 'product',
    cin7_id: 'PROD-CIN7-1005',
    erp_id: null,
    field_name: null,
    cin7_value: null,
    erp_value: null,
    severity: 'high',
    status: 'open',
    detected_at: new Date(Date.now() - 3600000).toISOString(),
    resolved_at: null,
    resolution_notes: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'demo-gap-4',
    shadow_sync_id: 'demo-shadow-4',
    gap_type: 'data_mismatch',
    entity_type: 'order',
    cin7_id: 'ORD-CIN7-7701',
    erp_id: '00000000-0000-0000-0000-000000000002',
    field_name: 'total',
    cin7_value: '1250.00',
    erp_value: '1200.00',
    severity: 'high',
    status: 'open',
    detected_at: new Date(Date.now() - 900000).toISOString(),
    resolved_at: null,
    resolution_notes: null,
    created_at: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'demo-gap-5',
    shadow_sync_id: 'demo-shadow-5',
    gap_type: 'missing_in_cin7',
    entity_type: 'supplier',
    cin7_id: 'SUP-CIN7-9901',
    erp_id: '00000000-0000-0000-0000-000000000003',
    field_name: null,
    cin7_value: null,
    erp_value: null,
    severity: 'medium',
    status: 'open',
    detected_at: new Date(Date.now() - 86400000).toISOString(),
    resolved_at: null,
    resolution_notes: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const DEMO_AI_ANALYSIS: ShadowAiAnalysis = {
  entity_summary: [
    { entity_type: 'order', severity: 'critical', count: 2 },
    { entity_type: 'product', severity: 'high', count: 3 },
    { entity_type: 'customer', severity: 'medium', count: 3 },
  ],
  total_gaps: 8,
  critical_count: 2,
  recommendations: [
    {
      entity_type: 'order',
      gap_count: 2,
      priority: 1,
      recommendation: 'Immediately re-sync Cin7 orders — 2 critical discrepancies detected',
    },
    {
      entity_type: 'product',
      gap_count: 3,
      priority: 2,
      recommendation: 'High gap volume for product — schedule bulk reconciliation (3 open gaps)',
    },
    {
      entity_type: 'customer',
      gap_count: 3,
      priority: 0,
      recommendation: 'All entities are in sync — no action required',
    },
  ],
  analyzed_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function severityBadgeVariant(
  severity: SeverityType
): 'destructive' | 'default' | 'secondary' | 'outline' {
  switch (severity) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    default:
      return 'secondary';
  }
}

function severityColorClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-destructive';
    case 'high':
      return 'bg-orange-500';
    case 'medium':
      return 'bg-yellow-500';
    default:
      return 'bg-secondary';
  }
}

function statusBadgeVariant(
  status: StatusType
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'open':
      return 'default';
    case 'investigating':
      return 'outline';
    case 'resolved':
      return 'secondary';
    case 'ignored':
      return 'secondary';
    default:
      return 'default';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="mb-2 h-8 w-16" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

interface ResolveDialogProps {
  gap: Cin7SyncGap | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  isSubmitting: boolean;
}

function ResolveDialog({ gap, open, onClose, onConfirm, isSubmitting }: ResolveDialogProps) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) setNotes('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve Gap</DialogTitle>
          <DialogDescription>
            Mark this gap as resolved.{' '}
            {gap && (
              <span className="font-medium">
                {gap.entity_type} / {gap.cin7_id}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="resolution-notes">
            Resolution Notes (optional)
          </label>
          <Textarea
            id="resolution-notes"
            placeholder="Describe how this gap was resolved..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(notes)} disabled={isSubmitting}>
            {isSubmitting ? 'Resolving...' : 'Mark Resolved'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// AI Recommendation row sub-component
// ---------------------------------------------------------------------------

interface AiRecommendationRowProps {
  rec: ShadowAiRecommendation;
}

function AiRecommendationRow({ rec }: AiRecommendationRowProps) {
  const isOk = rec.priority === 0;
  const isCritical = rec.priority === 1;
  const isHigh = rec.priority === 2;

  const borderClass = isOk
    ? 'border-green-300 dark:border-green-700'
    : isCritical
      ? 'border-destructive/60'
      : isHigh
        ? 'border-orange-400 dark:border-orange-600'
        : 'border-border';

  const bgClass = isOk
    ? 'bg-green-50 dark:bg-green-950/30'
    : isCritical
      ? 'bg-destructive/5'
      : isHigh
        ? 'bg-orange-50 dark:bg-orange-950/30'
        : 'bg-muted/40';

  const iconElement = isOk ? (
    <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
  ) : isCritical ? (
    <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
  ) : (
    <AlertCircle className="h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400" />
  );

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${borderClass} ${bgClass}`}>
      {iconElement}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold capitalize">
            {rec.entity_type.replace(/_/g, ' ')}
          </span>
          <Badge
            variant={isOk ? 'secondary' : isCritical ? 'destructive' : 'outline'}
            className="text-xs"
          >
            {isOk ? 'OK' : isCritical ? 'Critical' : isHigh ? 'High' : 'Review'}
          </Badge>
          {rec.gap_count > 0 && (
            <span className="text-muted-foreground text-xs">
              {rec.gap_count} gap{rec.gap_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm">{rec.recommendation}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ShadowSyncDashboardPage() {
  const { toast } = useToast();

  // Data state
  const [status, setStatus] = useState<Cin7ShadowStatus | null>(null);
  const [summary, setSummary] = useState<Cin7GapSummaryItem[]>([]);
  const [gaps, setGaps] = useState<Cin7SyncGap[]>([]);
  const [gapsTotal, setGapsTotal] = useState(0);

  // UI state
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loadingGaps, setLoadingGaps] = useState(true);
  const [headerError, setHeaderError] = useState(false);
  const [gapsError, setGapsError] = useState(false);
  const [isDemoFallback, setIsDemoFallback] = useState(false);
  const [polling, setPolling] = useState(false);

  // Filters + pagination
  const [filterEntity, setFilterEntity] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Resolve dialog
  const [resolveTarget, setResolveTarget] = useState<Cin7SyncGap | null>(null);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<ShadowAiAnalysis | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAutoResolving, setAiAutoResolving] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadHeaderData = useCallback(async () => {
    setHeaderError(false);
    const [statusResult, summaryResult] = await Promise.allSettled([
      getShadowStatus(),
      getSyncGapsSummary(),
    ]);

    if (statusResult.status === 'fulfilled' && summaryResult.status === 'fulfilled') {
      setStatus(statusResult.value);
      setSummary(summaryResult.value);
      setIsDemoFallback(false);
    } else {
      // Use demo fallback when API is unreachable
      setStatus(DEMO_STATUS);
      setSummary(DEMO_SUMMARY);
      setIsDemoFallback(true);
    }
  }, []);

  const loadGaps = useCallback(
    async (page: number) => {
      setLoadingGaps(true);
      setGapsError(false);
      try {
        const result = await listSyncGaps(
          page,
          PAGE_SIZE,
          filterEntity === 'all' ? undefined : filterEntity,
          filterSeverity === 'all' ? undefined : filterSeverity
        );
        // Client-side status filter since backend may not expose it
        const filtered =
          filterStatus === 'all'
            ? result.items
            : result.items.filter((g) => g.status === filterStatus);
        setGaps(filtered);
        setGapsTotal(result.total);
      } catch {
        if (isDemoFallback) {
          // Apply demo filters client-side
          let filtered = [...DEMO_GAPS];
          if (filterEntity !== 'all')
            filtered = filtered.filter((g) => g.entity_type === filterEntity);
          if (filterSeverity !== 'all')
            filtered = filtered.filter((g) => g.severity === filterSeverity);
          if (filterStatus !== 'all') filtered = filtered.filter((g) => g.status === filterStatus);
          setGaps(filtered);
          setGapsTotal(filtered.length);
        } else {
          setGapsError(true);
        }
      } finally {
        setLoadingGaps(false);
      }
    },
    [filterEntity, filterSeverity, filterStatus, isDemoFallback]
  );

  // Load header data on mount
  useEffect(() => {
    setLoadingHeader(true);
    loadHeaderData().finally(() => setLoadingHeader(false));
  }, [loadHeaderData]);

  // Load gap list whenever filters or page changes
  useEffect(() => {
    loadGaps(currentPage);
  }, [loadGaps, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterEntity, filterSeverity, filterStatus]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handlePollNow = async () => {
    setPolling(true);
    try {
      const result = await triggerShadowPoll();
      toast({
        title: 'Shadow Poll Complete',
        description:
          result.mode === 'demo'
            ? `Demo poll detected ${result.gaps_detected ?? 0} gap(s) across ${result.records_checked ?? 0} records.`
            : (result.message ?? 'Poll triggered successfully.'),
      });
      await loadHeaderData();
      await loadGaps(currentPage);
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Poll Failed',
        description: err instanceof Error ? err.message : 'Failed to trigger shadow poll',
      });
    } finally {
      setPolling(false);
    }
  };

  const handleIgnore = async (gap: Cin7SyncGap) => {
    if (isDemoFallback) {
      toast({
        title: 'Demo Mode',
        description: 'Gap actions require a live backend.',
      });
      return;
    }
    try {
      await updateGapStatus(gap.id, 'ignored');
      toast({
        title: 'Gap Ignored',
        description: `${gap.entity_type} ${gap.cin7_id} marked as ignored.`,
      });
      await loadGaps(currentPage);
      await loadHeaderData();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Could not update gap',
      });
    }
  };

  const handleInvestigate = async (gap: Cin7SyncGap) => {
    if (isDemoFallback) {
      toast({
        title: 'Demo Mode',
        description: 'Gap actions require a live backend.',
      });
      return;
    }
    try {
      await updateGapStatus(gap.id, 'investigating');
      toast({
        title: 'Gap Under Investigation',
        description: `${gap.entity_type} ${gap.cin7_id} is now being investigated.`,
      });
      await loadGaps(currentPage);
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Could not update gap',
      });
    }
  };

  const handleResolveConfirm = async (notes: string) => {
    if (!resolveTarget) return;
    if (isDemoFallback) {
      toast({
        title: 'Demo Mode',
        description: 'Gap resolution requires a live backend.',
      });
      setResolveTarget(null);
      return;
    }
    setResolveSubmitting(true);
    try {
      await updateGapStatus(resolveTarget.id, 'resolved', notes.trim() || undefined);
      toast({
        title: 'Gap Resolved',
        description: `${resolveTarget.entity_type} ${resolveTarget.cin7_id} has been resolved.`,
      });
      setResolveTarget(null);
      await loadGaps(currentPage);
      await loadHeaderData();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Resolve Failed',
        description: err instanceof Error ? err.message : 'Could not resolve gap',
      });
    } finally {
      setResolveSubmitting(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    setAiAnalysisLoading(true);
    try {
      const result = await analyzeShadowGaps();
      setAiAnalysis(result);
    } catch {
      // Fall back to demo data so the section always shows something useful
      setAiAnalysis(DEMO_AI_ANALYSIS);
      toast({
        title: 'AI Analysis (Demo)',
        description: 'Backend unavailable — showing demo recommendations.',
      });
    } finally {
      setAiAnalysisLoading(false);
    }
  };

  const handleAiAutoResolve = async () => {
    if (!window.confirm('Auto-resolve all open gaps older than 7 days? This cannot be undone.'))
      return;
    setAiAutoResolving(true);
    try {
      const result = await autoResolveStaleShadowGaps(7);
      toast({
        title: 'Auto-Resolve Complete',
        description: result.message,
      });
      // Refresh gap data
      await loadHeaderData();
      await loadGaps(currentPage);
      // Re-run AI analysis to reflect updated state
      await handleRunAiAnalysis();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Auto-Resolve Failed',
        description: err instanceof Error ? err.message : 'Could not auto-resolve gaps',
      });
    } finally {
      setAiAutoResolving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(gapsTotal / PAGE_SIZE));
  const maxEntityGaps = status ? Math.max(1, ...Object.values(status.gap_by_entity)) : 1;

  // Group summary by entity for the summary grid
  const summaryByEntity = ENTITY_TYPES.reduce<Record<EntityType, Cin7GapSummaryItem[]>>(
    (acc, et) => {
      acc[et] = summary.filter((s) => s.entity_type === et);
      return acc;
    },
    {} as Record<EntityType, Cin7GapSummaryItem[]>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loadingHeader) {
    return (
      <div className="container mx-auto max-w-6xl px-6 py-8">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-6 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-muted-foreground mb-1 flex items-center gap-2 text-sm">
            <Link
              href="/settings?panel=integrations"
              className="hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Integrations
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cin7 Shadow Sync Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Monitor data gaps between Cin7 and your ERP
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isDemoFallback && (
            <Badge variant="secondary" className="text-xs">
              Demo Fallback
            </Badge>
          )}
          <div className="text-muted-foreground text-right text-xs">
            {status?.last_poll_at ? (
              <>
                <span className="block">Last poll</span>
                <span className="font-medium">{formatTimestamp(status.last_poll_at)}</span>
              </>
            ) : (
              <span>No poll run yet</span>
            )}
          </div>
          <Button onClick={handlePollNow} disabled={polling} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${polling ? 'animate-spin' : ''}`} />
            {polling ? 'Polling...' : 'Poll Now'}
          </Button>
        </div>
      </div>

      {headerError && (
        <div className="border-destructive/30 bg-destructive/10 flex items-center justify-between rounded-lg border p-4">
          <p className="text-destructive text-sm">Failed to load shadow sync status.</p>
          <Button size="sm" variant="outline" onClick={() => loadHeaderData()}>
            Retry
          </Button>
        </div>
      )}

      {/* Health summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {status?.total_synced ?? 0}
                </p>
                <p className="text-muted-foreground text-sm">Total Synced</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <AlertTriangle className="h-5 w-5 text-orange-500 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500 dark:text-orange-400">
                  {status?.total_gaps ?? 0}
                </p>
                <p className="text-muted-foreground text-sm">Total Gaps</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-destructive/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <XCircle className="text-destructive h-5 w-5" />
              </div>
              <div>
                <p className="text-destructive text-2xl font-bold">
                  {status?.total_conflicts ?? 0}
                </p>
                <p className="text-muted-foreground text-sm">Total Conflicts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gap breakdown by entity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gap Breakdown by Entity</CardTitle>
          <CardDescription>Number of open gaps per entity type</CardDescription>
        </CardHeader>
        <CardContent>
          {status && Object.keys(status.gap_by_entity).length > 0 ? (
            <div className="space-y-3">
              {ENTITY_TYPES.map((entityType) => {
                const count = status.gap_by_entity[entityType] ?? 0;
                const pct = maxEntityGaps > 0 ? (count / maxEntityGaps) * 100 : 0;
                return (
                  <div key={entityType} className="flex items-center gap-3">
                    <span className="text-muted-foreground w-36 shrink-0 text-sm capitalize">
                      {entityType.replace(/_/g, ' ')}
                    </span>
                    <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          count > 0 ? 'bg-orange-500' : 'bg-muted-foreground/20'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No gap data available.</p>
          )}
        </CardContent>
      </Card>

      {/* Gap summary grid by entity + severity */}
      {summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gap Summary by Severity</CardTitle>
            <CardDescription>Gaps grouped by entity type and severity level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ENTITY_TYPES.filter((et) => summaryByEntity[et].length > 0).map((entityType) => (
                <div key={entityType} className="bg-muted/30 space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium capitalize">{entityType.replace(/_/g, ' ')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                      const item = summaryByEntity[entityType].find((s) => s.severity === sev);
                      if (!item) return null;
                      return (
                        <div key={sev} className="flex items-center gap-1">
                          <span className={`h-2 w-2 rounded-full ${severityColorClass(sev)}`} />
                          <Badge variant={severityBadgeVariant(sev)} className="text-xs">
                            {sev}: {item.count}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Recommendations panel */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setAiPanelOpen((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className="text-primary h-4 w-4" />
              <CardTitle className="text-base">AI Recommendations</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {aiPanelOpen ? 'Collapse' : 'Expand'}
              </span>
            </div>
          </div>
          <CardDescription>
            AI-generated analysis of sync gaps with prioritised action items
          </CardDescription>
        </CardHeader>

        {aiPanelOpen && (
          <CardContent className="space-y-4">
            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={handleRunAiAnalysis} disabled={aiAnalysisLoading}>
                <BrainCircuit
                  className={`mr-2 h-4 w-4 ${aiAnalysisLoading ? 'animate-pulse' : ''}`}
                />
                {aiAnalysisLoading ? 'Analysing...' : 'Run Analysis'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAiAutoResolve}
                disabled={aiAutoResolving}
              >
                <CheckCircle className={`mr-2 h-4 w-4 ${aiAutoResolving ? 'animate-spin' : ''}`} />
                {aiAutoResolving ? 'Resolving...' : 'Auto-Resolve Stale (7d)'}
              </Button>
            </div>

            {/* Results */}
            {aiAnalysis ? (
              <div className="space-y-3">
                {/* Timestamp */}
                <p className="text-muted-foreground text-xs">
                  Analysed at: {formatTimestamp(aiAnalysis.analyzed_at)} &mdash;{' '}
                  {aiAnalysis.total_gaps} total gap
                  {aiAnalysis.total_gaps !== 1 ? 's' : ''}, {aiAnalysis.critical_count} critical
                </p>

                {/* Recommendation rows */}
                {[...aiAnalysis.recommendations]
                  .sort((a, b) => a.priority - b.priority)
                  .map((rec: ShadowAiRecommendation, idx: number) => (
                    <AiRecommendationRow key={idx} rec={rec} />
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Click &ldquo;Run Analysis&rdquo; to generate AI recommendations based on current
                sync gaps.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <Separator />

      {/* Gap list table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Sync Gaps</CardTitle>
              <CardDescription>
                {gapsTotal} gap{gapsTotal !== 1 ? 's' : ''} found
              </CardDescription>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="Entity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {ENTITY_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>
                      <span className="capitalize">{et.replace(/_/g, ' ')}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {gapsError ? (
            <div className="space-y-3 p-6 text-center">
              <p className="text-muted-foreground text-sm">Failed to load sync gaps.</p>
              <Button size="sm" variant="outline" onClick={() => loadGaps(currentPage)}>
                Retry
              </Button>
            </div>
          ) : loadingGaps ? (
            <div className="space-y-2 p-6">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : gaps.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="mx-auto mb-3 h-8 w-8 text-green-500" />
              <p className="text-muted-foreground text-sm">No gaps match the current filters.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-b-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Entity Type</TableHead>
                    <TableHead className="text-xs">Cin7 ID</TableHead>
                    <TableHead className="text-xs">Gap Type</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Detected At</TableHead>
                    <TableHead className="text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gaps.map((gap) => (
                    <TableRow key={gap.id}>
                      <TableCell className="py-2 text-xs font-medium capitalize">
                        {gap.entity_type.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-2 font-mono text-xs">
                        {gap.cin7_id}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {gap.gap_type.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={severityBadgeVariant(gap.severity)} className="text-xs">
                          {gap.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={statusBadgeVariant(gap.status)} className="text-xs">
                          {gap.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-2 text-xs whitespace-nowrap">
                        {formatTimestamp(gap.detected_at)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {gap.status === 'open' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleInvestigate(gap)}
                              title="Mark as investigating"
                            >
                              Investigate
                            </Button>
                          )}
                          {(gap.status === 'open' || gap.status === 'investigating') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-green-700 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:hover:bg-green-950"
                                onClick={() => setResolveTarget(gap)}
                                title="Mark as resolved"
                              >
                                Resolve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground h-7 px-2 text-xs"
                                onClick={() => handleIgnore(gap)}
                                title="Mark as ignored"
                              >
                                Ignore
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-muted-foreground text-xs">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve dialog */}
      <ResolveDialog
        gap={resolveTarget}
        open={resolveTarget !== null}
        onClose={() => setResolveTarget(null)}
        onConfirm={handleResolveConfirm}
        isSubmitting={resolveSubmitting}
      />
    </div>
  );
}
