'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  XCircle,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getShadowStatus,
  listSyncGaps,
  triggerShadowPoll,
  updateGapStatus,
  type Cin7ShadowStatus,
  type Cin7SyncGap,
} from '@/lib/api/cin7-shadow';

// ---------------------------------------------------------------------------
// Demo fallback values shown when the API is unavailable
// ---------------------------------------------------------------------------

const DEMO_STATUS: Cin7ShadowStatus = {
  total_synced: 3,
  total_gaps: 2,
  total_conflicts: 1,
  last_poll_at: null,
  gap_by_entity: { product: 2, customer: 1 },
};

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
    severity: 'high',
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
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityBadgeVariant(
  severity: Cin7SyncGap['severity']
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

function formatDetectedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Cin7ShadowSyncCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Cin7ShadowStatus | null>(null);
  const [gaps, setGaps] = useState<Cin7SyncGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [isDemoFallback, setIsDemoFallback] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statusData, gapsData] = await Promise.all([getShadowStatus(), listSyncGaps(1, 5)]);
      setStatus(statusData);
      setGaps(gapsData.items.slice(0, 5));
      setIsDemoFallback(false);
    } catch {
      // API unavailable — show demo data so the card is still useful
      setStatus(DEMO_STATUS);
      setGaps(DEMO_GAPS);
      setIsDemoFallback(true);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

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
      await loadData();
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

  const handleResolveGap = async (gap: Cin7SyncGap) => {
    if (isDemoFallback) {
      toast({ title: 'Demo Mode', description: 'Gap resolution requires a live backend.' });
      return;
    }
    try {
      await updateGapStatus(gap.id, 'resolved', 'Resolved via Shadow Sync dashboard');
      toast({
        title: 'Gap Resolved',
        description: `${gap.entity_type} ${gap.cin7_id} marked resolved.`,
      });
      await loadData();
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Could not resolve gap',
      });
    }
  };

  // ------ Loading skeleton ------
  if (loading) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-4 h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalGapsAndConflicts = (status?.total_gaps ?? 0) + (status?.total_conflicts ?? 0);

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <Activity className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base">Shadow Sync</CardTitle>
              <CardDescription>Gap detection between Cin7 and ERP</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDemoFallback && (
              <Badge variant="secondary" className="text-xs">
                Demo Fallback
              </Badge>
            )}
            {totalGapsAndConflicts > 0 ? (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {totalGapsAndConflicts} issue{totalGapsAndConflicts > 1 ? 's' : ''}
              </Badge>
            ) : (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Clean
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status summary row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/40 rounded-lg border px-3 py-2 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {status?.total_synced ?? 0}
            </p>
            <p className="text-muted-foreground text-xs">Synced</p>
          </div>
          <div className="bg-muted/40 rounded-lg border px-3 py-2 text-center">
            <p className="text-2xl font-bold text-orange-500 dark:text-orange-400">
              {status?.total_gaps ?? 0}
            </p>
            <p className="text-muted-foreground text-xs">Gaps</p>
          </div>
          <div className="bg-muted/40 rounded-lg border px-3 py-2 text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {status?.total_conflicts ?? 0}
            </p>
            <p className="text-muted-foreground text-xs">Conflicts</p>
          </div>
        </div>

        {/* Last poll timestamp + Poll Now button */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs">
            {status?.last_poll_at
              ? `Last poll: ${formatDetectedAt(status.last_poll_at)}`
              : 'No poll run yet'}
          </p>
          <Button onClick={handlePollNow} disabled={polling} size="sm" variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${polling ? 'animate-spin' : ''}`} />
            {polling ? 'Polling...' : 'Poll Now'}
          </Button>
        </div>

        {/* Link to full dashboard */}
        <div className="flex justify-end">
          <Link href="/dashboard/settings/integrations/shadow">
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              View Full Dashboard
            </Button>
          </Link>
        </div>

        {/* Recent gaps table */}
        {gaps.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-medium">Recent Gaps</p>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Entity</TableHead>
                    <TableHead className="text-xs">Cin7 ID</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Detected</TableHead>
                    <TableHead className="w-20 text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gaps.map((gap) => (
                    <TableRow key={gap.id}>
                      <TableCell className="py-2 text-xs font-medium capitalize">
                        {gap.entity_type}
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
                      <TableCell className="text-muted-foreground py-2 text-xs">
                        {formatDetectedAt(gap.detected_at)}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleResolveGap(gap)}
                          title="Mark as resolved"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-200">
                No open gaps — all entities appear in sync.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
