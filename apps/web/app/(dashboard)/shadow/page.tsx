'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  getShadowStatus,
  listSyncGaps,
  triggerShadowPoll,
  updateGapStatus,
  type Cin7ShadowStatus,
  type Cin7SyncGap,
} from '@/lib/api/cin7-shadow';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Zap,
  Database,
  ShieldAlert,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityBadge(severity: Cin7SyncGap['severity']) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${map[severity] ?? ''}`}
    >
      {severity}
    </span>
  );
}

function statusBadge(status: Cin7SyncGap['status']) {
  const map: Record<string, string> = {
    open: 'bg-red-100 text-red-700',
    investigating: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    ignored: 'bg-gray-100 text-gray-500',
  };
  return (
    <Badge variant="outline" className={`text-xs ${map[status] ?? ''}`}>
      {status}
    </Badge>
  );
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShadowSyncPage() {
  const { toast } = useToast();

  const [status, setStatus] = useState<Cin7ShadowStatus | null>(null);
  const [gaps, setGaps] = useState<Cin7SyncGap[]>([]);
  const [gapsTotal, setGapsTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [polling, setPolling] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const s = await getShadowStatus();
      setStatus(s);
    } catch {
      // status load failure is non-critical
    }
  }, []);

  const loadGaps = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listSyncGaps(
        page,
        20,
        entityFilter || undefined,
        severityFilter || undefined
      );
      setGaps(result.items);
      setGapsTotal(result.total);
    } catch {
      toast({ title: 'Failed to load gaps', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, entityFilter, severityFilter, toast]);

  useEffect(() => {
    loadStatus();
    loadGaps();
  }, [loadStatus, loadGaps]);

  const handlePoll = async () => {
    setPolling(true);
    try {
      const result = await triggerShadowPoll();
      toast({
        title: 'Ghost sync triggered',
        description: `${result.total_checked ?? result.records_checked ?? 0} records checked · ${result.total_gap ?? result.records_gap ?? 0} gaps found`,
      });
      await loadStatus();
      await loadGaps();
    } catch {
      toast({ title: 'Poll failed', variant: 'destructive' });
    } finally {
      setPolling(false);
    }
  };

  const handleResolveGap = async (gap: Cin7SyncGap) => {
    try {
      await updateGapStatus(gap.id, 'resolved', 'Resolved via dashboard');
      toast({ title: 'Gap resolved' });
      await loadGaps();
    } catch {
      toast({ title: 'Failed to resolve gap', variant: 'destructive' });
    }
  };

  const handleIgnoreGap = async (gap: Cin7SyncGap) => {
    try {
      await updateGapStatus(gap.id, 'ignored');
      toast({ title: 'Gap ignored' });
      await loadGaps();
    } catch {
      toast({ title: 'Failed to ignore gap', variant: 'destructive' });
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ghost Sync</h1>
          <p className="text-muted-foreground text-sm">
            Nightly Cin7 → ERP shadow comparison · Last poll:{' '}
            {status?.last_poll_at ? formatDateTime(status.last_poll_at) : 'Never'}
          </p>
        </div>
        <Button onClick={handlePoll} disabled={polling}>
          {polling ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          {polling ? 'Syncing…' : 'Run Ghost Sync Now'}
        </Button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{status?.total_synced ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-orange-500" /> Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{status?.total_gaps ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
              <ShieldAlert className="h-4 w-4 text-red-500" /> Conflicts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{status?.total_conflicts ?? '—'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground flex items-center gap-1 text-sm font-medium">
              <Database className="h-4 w-4 text-blue-500" /> Open Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{gapsTotal}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gap by entity breakdown */}
      {status?.gap_by_entity && Object.keys(status.gap_by_entity).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Gaps by Entity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {Object.entries(status.gap_by_entity).map(([entity, count]) => (
              <div key={entity} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                <span className="text-sm font-medium capitalize">{entity}</span>
                <Badge variant="destructive" className="text-xs">
                  {count}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Gaps table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Open Sync Gaps ({gapsTotal})</CardTitle>
            <div className="flex gap-2">
              <Select
                value={entityFilter}
                onValueChange={(v) => {
                  setEntityFilter(v === 'all' ? '' : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {['product', 'customer', 'order', 'quote', 'supplier', 'purchase_order'].map(
                    (e) => (
                      <SelectItem key={e} value={e} className="capitalize">
                        {e}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

              <Select
                value={severityFilter}
                onValueChange={(v) => {
                  setSeverityFilter(v === 'all' ? '' : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="All severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severity</SelectItem>
                  {['critical', 'high', 'medium', 'low'].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="ghost" size="sm" onClick={loadGaps} className="h-8 px-2">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading gaps…
            </div>
          ) : gaps.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-16">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium">No open gaps</p>
              <p className="text-xs">Run a ghost sync to check for discrepancies.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead>Cin7 ID</TableHead>
                    <TableHead>Gap Type</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gaps.map((gap) => (
                    <TableRow key={gap.id}>
                      <TableCell className="font-medium capitalize">{gap.entity_type}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {gap.cin7_id}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs">{gap.gap_type.replace(/_/g, ' ')}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {gap.field_name ?? '—'}
                        {gap.cin7_value && (
                          <div className="text-muted-foreground mt-0.5 text-[11px]">
                            Cin7: <span className="font-mono">{gap.cin7_value.slice(0, 40)}</span>
                          </div>
                        )}
                        {gap.erp_value && (
                          <div className="text-muted-foreground text-[11px]">
                            ERP: <span className="font-mono">{gap.erp_value.slice(0, 40)}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{severityBadge(gap.severity)}</TableCell>
                      <TableCell>{statusBadge(gap.status)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(gap.detected_at)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {gap.status !== 'resolved' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-green-700 hover:text-green-900"
                              onClick={() => handleResolveGap(gap)}
                            >
                              Resolve
                            </Button>
                          )}
                          {gap.status === 'open' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground h-7 px-2 text-xs"
                              onClick={() => handleIgnoreGap(gap)}
                            >
                              Ignore
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {gapsTotal > 20 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-muted-foreground text-xs">
                    Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, gapsTotal)} of {gapsTotal}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page * 20 >= gapsTotal}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
