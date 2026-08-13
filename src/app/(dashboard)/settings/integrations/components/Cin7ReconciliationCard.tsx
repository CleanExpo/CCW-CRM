'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  getCin7B1Residuals,
  getCin7B1ResidualsExportUrl,
  getCin7ExceptionReport,
  getCin7ExceptionReportExportUrl,
  getCin7ReconSnapshot,
  getCin7Reconciliation,
  getCin7StockStability,
  healCin7FieldMismatches,
  listCin7ReconHistory,
  revertCin7HealAudit,
  type Cin7ExceptionEntity,
  type Cin7ExceptionRecord,
  type Cin7ReconciliationResponse,
} from '@/lib/api/cin7';
import { CIN7_LIVE_RECON_REFRESHED_EVENT } from '@/lib/integrations/cin7-client-sync-scheduler';
import {
  AlertTriangle,
  BarChart3,
  FileWarning,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

type Cin7ReconciliationCardProps = {
  isConnected: boolean;
};

const SNAPSHOT_SESSION_KEY = 'optix.cin7.recon.selectedSnapshotId';

const EXCEPTION_ENTITIES: { key: Cin7ExceptionEntity; label: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'branches', label: 'Branches' },
  { key: 'internal-customers', label: 'Internal' },
  { key: 'product-categories', label: 'Categories' },
  { key: 'brands', label: 'Brands' },
  { key: 'price-lists', label: 'Price lists' },
  { key: 'tax-codes', label: 'Tax codes' },
  { key: 'units-of-measure', label: 'UOM' },
  { key: 'stock-levels', label: 'Stock' },
  { key: 'warehouses', label: 'Warehouses' },
];

function CountRow({
  label,
  cin7,
  optix,
  mismatch,
}: {
  label: string;
  cin7: number | string;
  optix: number | string;
  mismatch?: boolean;
}) {
  return (
    <div className="border-border/50 flex items-center justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-medium tabular-nums ${mismatch ? 'text-amber-600 dark:text-amber-400' : ''}`}
      >
        Cin7 {cin7} · Optix {optix}
      </span>
    </div>
  );
}

function reasonLabel(reason: Cin7ExceptionRecord['reason']): string {
  switch (reason) {
    case 'missing_in_optix':
      return 'In Cin7, not in Optix';
    case 'extra_in_optix':
      return 'In Optix, not in Cin7';
    case 'field_mismatch':
      return 'Field mismatch';
    case 'skipped_on_sync':
      return 'Skipped on sync';
    default:
      return reason;
  }
}

function formatCacheAge(cachedAt: string | null | undefined): string {
  if (!cachedAt) return 'just now';
  const ageMs = Date.now() - new Date(cachedAt).getTime();
  if (ageMs < 60_000) return 'less than a minute ago';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

export function Cin7ReconciliationCard({ isConnected }: Cin7ReconciliationCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<Cin7ReconciliationResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exceptionEntity, setExceptionEntity] = useState<Cin7ExceptionEntity>('products');
  const [exceptions, setExceptions] = useState<Cin7ExceptionRecord[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);
  const [exceptionTotal, setExceptionTotal] = useState(0);
  const [exceptionOffset, setExceptionOffset] = useState(0);
  const [healingFields, setHealingFields] = useState(false);
  const [revertingPrune, setRevertingPrune] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listCin7ReconHistory>>['items']>(
    []
  );
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [residuals, setResiduals] = useState<Awaited<ReturnType<typeof getCin7B1Residuals>> | null>(
    null
  );
  const [stability, setStability] = useState<Awaited<
    ReturnType<typeof getCin7StockStability>
  > | null>(null);
  const [lastHealAuditId, setLastHealAuditId] = useState<string | null>(null);
  const loadRequestId = useRef(0);
  const EXCEPTION_PAGE = 100;

  const rememberSnapshotId = (id: string | null) => {
    setSelectedSnapshotId(id);
    try {
      if (id) sessionStorage.setItem(SNAPSHOT_SESSION_KEY, id);
      else sessionStorage.removeItem(SNAPSHOT_SESSION_KEY);
    } catch {
      /* private mode */
    }
  };

  const refreshEvidencePanels = useCallback(async () => {
    const [historyResult, residualResult, stabilityResult] = await Promise.allSettled([
      listCin7ReconHistory(20),
      getCin7B1Residuals(),
      getCin7StockStability(),
    ]);
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value.items);
    if (residualResult.status === 'fulfilled') setResiduals(residualResult.value);
    if (stabilityResult.status === 'fulfilled') setStability(stabilityResult.value);
    return historyResult.status === 'fulfilled' ? historyResult.value.items : [];
  }, []);

  const openStoredSnapshot = useCallback(
    async (id: string, options?: { silent?: boolean }) => {
      try {
        const stored = await getCin7ReconSnapshot(id);
        setSnapshot({
          ...stored,
          recon_run_id: stored.recon_run_id ?? id,
          read_only: true,
          cache_meta: {
            from_cache: false,
            cached_at: stored.checked_at,
            ttl_ms: 0,
            mode: stored.cache_meta?.mode ?? (stored.mode as 'live' | 'acceptance' | undefined),
          },
        });
        rememberSnapshotId(id);
        setLoadError(null);
        if (!options?.silent) {
          toast({
            title: 'Stored snapshot opened',
            description: 'Loaded from the audit trail — Cin7 was not re-walked.',
          });
        }
      } catch (error: unknown) {
        toast({
          variant: 'destructive',
          title: 'Could not open snapshot',
          description:
            error instanceof Error ? error.message : 'Snapshot not found for this account',
        });
      }
    },
    [toast]
  );

  const load = useCallback(
    async (options?: { force?: boolean; silent?: boolean; mode?: 'live' | 'acceptance' }) => {
      const requestId = ++loadRequestId.current;
      const force = options?.force ?? false;
      const mode = options?.mode;
      if (force || mode === 'acceptance') setLiveLoading(true);
      else setLoading(true);
      setLoadError(null);

      try {
        const data = await getCin7Reconciliation({ force, mode });
        if (requestId !== loadRequestId.current) return;
        setSnapshot(data);
        if (data.recon_run_id) rememberSnapshotId(data.recon_run_id);
        if (force || mode === 'acceptance') {
          void refreshEvidencePanels();
        }
        if (!options?.silent) {
          const acceptanceBlocked =
            data.acceptance_blocked || data.recon_status === 'blocked' || data.incomplete_sync;
          toast({
            title:
              mode === 'acceptance'
                ? acceptanceBlocked
                  ? 'Acceptance gate blocked'
                  : 'Acceptance gate passed'
                : force
                  ? 'Live Cin7 reconciliation complete'
                  : 'Reconciliation refreshed',
            description:
              mode === 'acceptance'
                ? data.blocked_reason ||
                  (acceptanceBlocked
                    ? 'Sync or Cin7 snapshot incomplete — not valid for sign-off.'
                    : 'Fail-closed gate: sync complete and exceptions clean.')
                : data.cache_meta?.from_cache
                  ? `Showing cached counts from ${formatCacheAge(data.cache_meta.cached_at)}. Use live refresh for a fresh Cin7 pull.`
                  : 'Counts updated from Cin7 and Optix.',
            variant: mode === 'acceptance' && acceptanceBlocked ? 'destructive' : undefined,
          });
        }
      } catch (error: unknown) {
        if (requestId !== loadRequestId.current) return;
        const message = error instanceof Error ? error.message : 'Could not load counts';
        setLoadError(message);
        toast({
          variant: 'destructive',
          title: 'Reconciliation failed',
          description: snapshot ? `${message} Showing your last successful counts below.` : message,
        });
      } finally {
        if (requestId === loadRequestId.current) {
          setLoading(false);
          setLiveLoading(false);
        }
      }
    },
    [refreshEvidencePanels, snapshot, toast]
  );

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    void (async () => {
      const items = await refreshEvidencePanels();
      if (cancelled) return;
      let storedId: string | null = null;
      try {
        storedId = sessionStorage.getItem(SNAPSHOT_SESSION_KEY);
      } catch {
        storedId = null;
      }
      const fromSession = storedId && items.some((item) => item.id === storedId) ? storedId : null;
      const latestAcceptance = items.find(
        (item) => item.mode === 'acceptance' && item.status === 'complete'
      );
      const fallback = fromSession ?? latestAcceptance?.id ?? items[0]?.id ?? null;
      if (fallback) await openStoredSnapshot(fallback, { silent: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, openStoredSnapshot, refreshEvidencePanels]);

  // After scheduled sync finishes, apply the live recon it just pulled.
  useEffect(() => {
    const onScheduledRecon = (event: Event) => {
      const detail = (event as CustomEvent<Cin7ReconciliationResponse>).detail;
      if (detail?.checked_at) {
        setSnapshot(detail);
        setLoadError(null);
      }
    };
    window.addEventListener(CIN7_LIVE_RECON_REFRESHED_EVENT, onScheduledRecon);
    return () => window.removeEventListener(CIN7_LIVE_RECON_REFRESHED_EVENT, onScheduledRecon);
  }, []);

  // Manual refresh only — auto-loading on connect fights sync for Cin7 rate limits
  // and looks like "reloading from scratch" every time status flips.
  const loadExceptions = async (entity: Cin7ExceptionEntity, offset = 0, append = false) => {
    setExceptionsLoading(true);
    setExceptionEntity(entity);
    try {
      const data = await getCin7ExceptionReport(entity, EXCEPTION_PAGE, offset);
      setExceptions((prev) => (append ? [...prev, ...data.items] : data.items));
      setExceptionTotal(data.total);
      setExceptionOffset(offset + data.items.length);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Exception report failed',
        description: error instanceof Error ? error.message : 'Could not load exceptions',
      });
      if (!append) {
        setExceptions([]);
        setExceptionTotal(0);
        setExceptionOffset(0);
      }
    } finally {
      setExceptionsLoading(false);
    }
  };

  const ex = snapshot?.exceptions_summary;
  const productFieldBreakdown = snapshot?.products_field_mismatch_breakdown;
  const fieldDiffTotal =
    (ex?.products_field_mismatches ?? 0) +
    (ex?.customers_field_mismatches ?? 0) +
    (ex?.suppliers_field_mismatches ?? 0) +
    (ex?.branches_field_mismatches ?? 0) +
    (ex?.internal_customers_field_mismatches ?? 0) +
    (ex?.stock_levels_field_mismatches ?? 0);
  const isRefreshing = loading || liveLoading || healingFields || revertingPrune;
  const fromCache = snapshot?.cache_meta?.from_cache;

  const healFieldDiffs = async () => {
    const ok = window.confirm(
      'Apply field heal?\n\nThis is a separate repair action (not part of the report). It overwrites matching Optix fields from live Cin7 and writes an audit log that can be reverted.'
    );
    if (!ok) return;
    setHealingFields(true);
    try {
      const result = await healCin7FieldMismatches();
      setLastHealAuditId(result.audit_run_id);
      toast({
        title:
          result.healed_total > 0
            ? `Field heal applied (${result.healed_total} rows)`
            : 'No field diffs to heal',
        description: `${result.summary} Audit: ${result.audit_run_id}`,
        variant: result.errors.length > 0 ? 'destructive' : undefined,
      });
      await load({ force: true, silent: true });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Field heal failed',
        description: error instanceof Error ? error.message : 'Could not heal field diffs',
      });
    } finally {
      setHealingFields(false);
    }
  };

  const revertLastPrune = async () => {
    const auditId = stability?.last_prune_audit?.id;
    if (!auditId) return;
    const ok = window.confirm(
      `Revert stock prune ${auditId}?\n\nThis restores every Optix stock row stored on that audit's before-image. It does not re-run Cin7.`
    );
    if (!ok) return;
    setRevertingPrune(true);
    try {
      const result = await revertCin7HealAudit(auditId);
      toast({
        title: `Reverted ${result.reverted} pruned stock row${result.reverted === 1 ? '' : 's'}`,
        description: `Audit ${auditId} is now reverted.`,
      });
      await refreshEvidencePanels();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Prune revert failed',
        description: error instanceof Error ? error.message : 'Could not revert prune',
      });
    } finally {
      setRevertingPrune(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Master data reconciliation
        </CardTitle>
        <CardDescription>
          Read-only measurement against Cin7. This report does not heal, align, or delete Optix
          data. The acceptance gate is the only sign-off number. Live refresh is measurement only
          and is not used for close-out.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/40 rounded-lg border px-3 py-2 text-xs leading-relaxed">
          <p className="font-medium">Account-scoped ledger</p>
          <p className="text-muted-foreground mt-0.5">
            Sync runs and reconciliation are stored per Optix account. Two users on the same URL can
            see different last-sync times and counts — that is expected, not a shared global ledger.
            Stored snapshots stay listed after reload; click a row to open it without re-running
            Cin7.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!isConnected || isRefreshing}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh counts
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!isConnected || isRefreshing}
            onClick={() => void load({ force: true })}
            title="Measurement only — 429s are fail-closed and masked. Not used for sign-off."
          >
            {liveLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Live measurement (not sign-off)
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={!isConnected || isRefreshing}
            onClick={() => void load({ force: true, mode: 'acceptance' })}
          >
            {liveLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="mr-2 h-4 w-4" />
            )}
            Run acceptance gate
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!isConnected || !snapshot || exceptionsLoading}
            onClick={() => void loadExceptions(exceptionEntity, 0, false)}
          >
            {exceptionsLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileWarning className="mr-2 h-4 w-4" />
            )}
            Load exception report
          </Button>
          {fieldDiffTotal > 0 && !snapshot?.acceptance_blocked ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={!isConnected || isRefreshing}
              onClick={() => void healFieldDiffs()}
              title="Separate audited repair — does not run inside the report"
            >
              {healingFields ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="mr-2 h-4 w-4" />
              )}
              Apply field heal ({fieldDiffTotal})
            </Button>
          ) : null}
        </div>

        {snapshot?.read_only ? (
          <p className="text-muted-foreground text-xs">
            Read-only report
            {snapshot.recon_run_id ? ` · snapshot ${snapshot.recon_run_id.slice(0, 8)}…` : null}
            {lastHealAuditId ? ` · last repair audit ${lastHealAuditId.slice(0, 8)}…` : null}
          </p>
        ) : null}

        <div className="rounded-lg border p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
            <History className="h-3.5 w-3.5" />
            Stored snapshots (this account)
          </p>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No stored snapshots yet. Run the acceptance gate to create a sign-off snapshot. Reload
              does not clear this list once snapshots exist.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {history.map((item) => {
                const selected = item.id === selectedSnapshotId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`border-border/40 flex w-full flex-wrap justify-between gap-2 border-b py-1.5 text-left last:border-0 ${
                        selected ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}
                      onClick={() => void openStoredSnapshot(item.id)}
                    >
                      <span>
                        {new Date(item.checked_at).toLocaleString()} · {item.mode} · {item.status}
                        {item.stock_truncated ? ' · truncated' : ''}
                        {selected ? ' · open' : ''}
                      </span>
                      <span className="tabular-nums">
                        SKU {item.products_cin7 ?? '—'}/{item.products_optix ?? '—'} · stock fetched{' '}
                        {item.stock_cin7 ?? '—'}
                        {item.stock_reported_total != null
                          ? ` of Total ${item.stock_reported_total}`
                          : ''}{' '}
                        / Optix {item.stock_optix ?? '—'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border p-3">
          <p className="mb-1 text-xs font-medium">Closed residual (B1)</p>
          <p className="text-muted-foreground mb-2 text-xs">
            {residuals?.note ??
              'Record-by-record list from the last complete acceptance run. Stock is not part of this residual.'}
          </p>
          {residuals ? (
            <div className="text-muted-foreground mb-2 space-y-0.5 text-xs tabular-nums">
              <p>
                Products {residuals.counts.products?.missing ?? 0} missing ·{' '}
                {residuals.counts.products?.extra ?? 0} extra
              </p>
              <p>
                Customers {residuals.counts.customers?.missing ?? 0} missing ·{' '}
                {residuals.counts.customers?.extra ?? 0} extra
              </p>
              <p>
                Suppliers {residuals.counts.suppliers?.missing ?? 0} missing ·{' '}
                {residuals.counts.suppliers?.extra ?? 0} extra
              </p>
              <p>
                Tax codes {residuals.counts['tax-codes']?.missing ?? 0} missing ·{' '}
                {residuals.counts['tax-codes']?.extra ?? 0} extra
              </p>
            </div>
          ) : null}
          {residuals && residuals.items.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {residuals.items.map((row, idx) => (
                <div
                  key={`${row.entity_type}-${row.cin7_id}-${row.reason}-${idx}`}
                  className="border-border/60 rounded-md border px-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">
                      {row.entity_type}: {row.label}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {row.reason === 'missing_in_optix'
                        ? 'In Cin7, not in Optix'
                        : 'In Optix, not in Cin7'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 font-mono">{row.cin7_id}</p>
                  <p className="mt-1">{row.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              No B1 residual rows on the last complete acceptance run.
            </p>
          )}
          <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" asChild>
            <a href={getCin7B1ResidualsExportUrl()} download>
              Export B1 CSV
            </a>
          </Button>
        </div>

        <div className="rounded-lg border p-3">
          <p className="mb-1 text-xs font-medium">
            Cin7 stock count — three consecutive acceptance runs
          </p>
          <p className="text-muted-foreground mb-2 text-xs">
            {stability?.reason ??
              'Run the acceptance gate three times so the Cin7 stock row count can be compared for stability.'}
          </p>
          {stability?.runs.length ? (
            <ul className="space-y-1 text-xs">
              {stability.runs.map((run) => (
                <li
                  key={run.id}
                  className="text-muted-foreground flex flex-wrap justify-between gap-2 tabular-nums"
                >
                  <span>
                    {new Date(run.checked_at).toLocaleString()}
                    {run.truncated ? ' · truncated' : ''}
                  </span>
                  <span>
                    Cin7 fetched {run.stock_cin7 ?? '—'}
                    {run.cin7_reported_total != null ? ` · Total ${run.cin7_reported_total}` : ''} ·
                    Optix {run.stock_optix ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">No complete acceptance runs yet.</p>
          )}
          <p className="mt-2 text-xs font-medium">
            {stability?.stable ? 'Cin7 stock count is stable.' : 'Cin7 stock count is not stable.'}
          </p>
        </div>

        <div className="rounded-lg border p-3">
          <p className="mb-1 text-xs font-medium">
            {stability?.stable
              ? 'Stock prune — Cin7 count is stable; prune is still a separate action'
              : 'Stock prune — locked until Cin7 count is stable'}
          </p>
          <p className="text-muted-foreground text-xs">
            {stability?.stable
              ? 'The three-run Cin7 stock count is stable. Prune is still a separate audited action and is not run from this report.'
              : 'Prune is a separate audited action and is not enabled. The client asked not to prune against a moving or truncated Cin7 catalog.'}{' '}
            When a prune does run, each deleted Optix stock row is stored on the heal audit{' '}
            <span className="font-mono">before_json</span>. Revert restores those rows via the audit
            id — it does not re-walk Cin7.
          </p>
          {stability?.last_prune_audit ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Last prune audit {stability.last_prune_audit.id} · {stability.last_prune_audit.status}{' '}
              · {stability.last_prune_audit.deleted_total} rows ·{' '}
              {stability.last_prune_audit.reversible ? 'reversible' : 'already reverted'}
            </p>
          ) : (
            <p className="text-muted-foreground mt-2 text-xs">No prune audit exists yet.</p>
          )}
          {stability?.last_prune_audit?.reversible ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={revertingPrune}
              onClick={() => void revertLastPrune()}
            >
              {revertingPrune ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Revert last prune from audit
            </Button>
          ) : null}
        </div>

        {loadError ? (
          <p className="flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {loadError}
            {snapshot ? ' Your last successful reconciliation is shown below.' : null}
          </p>
        ) : null}

        {snapshot?.source === 'none' ? (
          <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
            <p className="text-destructive flex items-start gap-1.5 text-sm font-medium">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Cin7 is unreachable — counts below are not valid for acceptance. Reconnect and refresh
              from live Cin7.
            </p>
          </div>
        ) : null}

        {snapshot &&
        (snapshot.fetch_meta.errors.length > 0 ||
          snapshot.fetch_meta.incomplete ||
          snapshot.acceptance_blocked) ? (
          <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-3">
            <p className="text-destructive flex items-start gap-1.5 text-sm font-medium">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Cin7 fetch was incomplete — do not use this snapshot for sign-off until a clean
              acceptance gate succeeds. Live measurement 429s are fail-closed and masked.
            </p>
            {snapshot.fetch_meta.errors.length > 0 ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {snapshot.fetch_meta.errors.slice(0, 3).join('; ')}
              </p>
            ) : null}
          </div>
        ) : null}

        {snapshot ? (
          <div className="space-y-4">
            <div
              className={`bg-muted/30 space-y-3 rounded-lg border p-4 ${isRefreshing ? 'opacity-70' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Source: {snapshot.source}</Badge>
                  {fromCache ? (
                    <Badge variant="secondary" className="text-xs">
                      Cached · {formatCacheAge(snapshot.cache_meta?.cached_at)}
                    </Badge>
                  ) : null}
                  {isRefreshing ? (
                    <Badge variant="outline" className="text-xs">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Updating…
                    </Badge>
                  ) : null}
                </div>
                <span className="text-muted-foreground text-xs">
                  Checked {new Date(snapshot.checked_at).toLocaleString()}
                </span>
              </div>
              <CountRow
                label="Product SKUs (all visibility)"
                cin7={snapshot.cin7.products.skus}
                optix={snapshot.optix.products.skus}
                mismatch={snapshot.cin7.products.skus !== snapshot.optix.products.skus}
              />
              <CountRow
                label="Product styles"
                cin7={snapshot.cin7.products.styles}
                optix={snapshot.optix.products.styles}
                mismatch={snapshot.cin7.products.styles !== snapshot.optix.products.styles}
              />
              <CountRow
                label="CRM customers"
                cin7={snapshot.cin7.customers}
                optix={snapshot.optix.customers.cin7_linked}
                mismatch={snapshot.cin7.customers !== snapshot.optix.customers.cin7_linked}
              />
              <CountRow
                label="Internal customers"
                cin7={snapshot.cin7.internal_customers}
                optix={snapshot.optix.internal_customers}
              />
              <CountRow
                label="Suppliers"
                cin7={snapshot.cin7.suppliers}
                optix={snapshot.optix.suppliers.cin7_linked}
                mismatch={snapshot.cin7.suppliers !== snapshot.optix.suppliers.cin7_linked}
              />
              <CountRow
                label="Branches"
                cin7={snapshot.cin7.branches}
                optix={snapshot.optix.branches.total}
                mismatch={snapshot.cin7.branches !== snapshot.optix.branches.total}
              />

              {snapshot.cin7.reference && snapshot.optix.reference ? (
                <>
                  <CountRow
                    label="Product categories"
                    cin7={snapshot.cin7.reference.product_categories}
                    optix={snapshot.optix.reference.product_categories}
                    mismatch={
                      snapshot.cin7.reference.product_categories !==
                      snapshot.optix.reference.product_categories
                    }
                  />
                  <CountRow
                    label="Brands"
                    cin7={snapshot.cin7.reference.brands}
                    optix={snapshot.optix.reference.brands}
                    mismatch={snapshot.cin7.reference.brands !== snapshot.optix.reference.brands}
                  />
                  <CountRow
                    label="Price lists"
                    cin7={snapshot.cin7.reference.price_lists}
                    optix={snapshot.optix.reference.price_lists}
                    mismatch={
                      snapshot.cin7.reference.price_lists !== snapshot.optix.reference.price_lists
                    }
                  />
                  <CountRow
                    label="Tax codes"
                    cin7={snapshot.cin7.reference.tax_codes}
                    optix={snapshot.optix.reference.tax_codes}
                    mismatch={
                      snapshot.cin7.reference.tax_codes !== snapshot.optix.reference.tax_codes
                    }
                  />
                  <CountRow
                    label="Units of measure"
                    cin7={snapshot.cin7.reference.units_of_measure}
                    optix={snapshot.optix.reference.units_of_measure}
                    mismatch={
                      snapshot.cin7.reference.units_of_measure !==
                      snapshot.optix.reference.units_of_measure
                    }
                  />
                  <CountRow
                    label="Stock levels (branch × SKU)"
                    cin7={snapshot.cin7.reference.stock_levels}
                    optix={snapshot.optix.reference.stock_levels}
                    mismatch={
                      snapshot.cin7.reference.stock_levels !== snapshot.optix.reference.stock_levels
                    }
                  />
                  {snapshot.stock_evidence ? (
                    <p
                      className={`text-xs ${
                        snapshot.stock_evidence.truncated || !snapshot.stock_evidence.complete
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground'
                      }`}
                    >
                      Fetched {snapshot.stock_evidence.cin7_rows}
                      {' · distinct branch×SKU '}
                      {snapshot.cin7.reference.stock_levels}
                      {' · Optix '}
                      {snapshot.optix.reference.stock_levels}
                      {snapshot.stock_evidence.cin7_reported_total != null
                        ? ` · Cin7 Total ${snapshot.stock_evidence.cin7_reported_total}`
                        : ' · Cin7 Total not reported'}
                      {' · truncated: '}
                      {snapshot.stock_evidence.truncated ? 'yes' : 'no'}
                      {snapshot.stock_evidence.cin7_rows !== snapshot.cin7.reference.stock_levels
                        ? ' — fetched is raw walk rows; distinct is unique branch×SKU (duplicates in the walk are not extras).'
                        : ''}
                      {snapshot.stock_evidence.truncated
                        ? ' Not a sign-off stock number (prior complete readings were ~10,500).'
                        : snapshot.stock_evidence.cin7_reported_total == null
                          ? ' Completeness vs the ~10,500 prior readings cannot be proven from this snapshot.'
                          : ' This walk matched Cin7 Total.'}
                    </p>
                  ) : null}
                  <CountRow
                    label="Warehouses (Cin7 branches)"
                    cin7={snapshot.cin7.reference.warehouses}
                    optix={snapshot.optix.reference.warehouses}
                    mismatch={
                      snapshot.cin7.reference.warehouses !== snapshot.optix.reference.warehouses
                    }
                  />
                </>
              ) : null}

              {ex && snapshot.acceptance_blocked ? (
                <div className="border-border/50 mt-2 space-y-1 border-t pt-2 text-xs">
                  <p className="text-destructive font-medium">Exception summary unavailable</p>
                  <p className="text-muted-foreground">
                    Fail-closed: Cin7 pull was incomplete, so missing/extra/field diffs are not
                    shown as clean zeros. Re-run the acceptance gate — live measurement is not
                    sign-off.
                  </p>
                </div>
              ) : ex ? (
                <div className="border-border/50 mt-2 space-y-1 border-t pt-2 text-xs">
                  <p className="text-muted-foreground font-medium">Exception summary</p>
                  <p>
                    Products: {ex.products_missing_in_optix} missing · {ex.products_extra_in_optix}{' '}
                    extra · {ex.products_field_mismatches} field diffs
                  </p>
                  {productFieldBreakdown && ex.products_field_mismatches > 0 ? (
                    <p className="text-muted-foreground pl-2">
                      Field diffs by type: stock {productFieldBreakdown.stock} · price{' '}
                      {productFieldBreakdown.price} · name {productFieldBreakdown.name} · active{' '}
                      {productFieldBreakdown.is_active} · visibility{' '}
                      {productFieldBreakdown.visibility}
                    </p>
                  ) : null}
                  <p>
                    Customers: {ex.customers_missing_in_optix} missing ·{' '}
                    {ex.customers_extra_in_optix} extra · {ex.customers_field_mismatches} field
                    diffs
                  </p>
                  <p>
                    Suppliers: {ex.suppliers_missing_in_optix} missing ·{' '}
                    {ex.suppliers_extra_in_optix} extra · {ex.suppliers_field_mismatches} field
                    diffs
                  </p>
                  <p>
                    Branches: {ex.branches_missing_in_optix} missing · {ex.branches_extra_in_optix}{' '}
                    extra · {ex.branches_field_mismatches} field diffs
                  </p>
                  <p>
                    Internal: {ex.internal_customers_missing_in_optix} missing ·{' '}
                    {ex.internal_customers_extra_in_optix} extra ·{' '}
                    {ex.internal_customers_field_mismatches} field diffs
                  </p>
                  <p>
                    Categories: {ex.product_categories_missing_in_optix} missing ·{' '}
                    {ex.product_categories_extra_in_optix} extra
                  </p>
                  <p>
                    Brands: {ex.brands_missing_in_optix} missing · {ex.brands_extra_in_optix} extra
                  </p>
                  <p>
                    Price lists: {ex.price_lists_missing_in_optix} missing ·{' '}
                    {ex.price_lists_extra_in_optix} extra
                  </p>
                  <p>
                    Tax codes: {ex.tax_codes_missing_in_optix} missing ·{' '}
                    {ex.tax_codes_extra_in_optix} extra
                  </p>
                  <p>
                    UOM: {ex.units_of_measure_missing_in_optix} missing ·{' '}
                    {ex.units_of_measure_extra_in_optix} extra
                  </p>
                  <p>
                    Stock: {ex.stock_levels_missing_in_optix} missing ·{' '}
                    {ex.stock_levels_extra_in_optix} extra · {ex.stock_levels_field_mismatches}{' '}
                    field diffs
                  </p>
                </div>
              ) : null}

              {snapshot.optix.customers.extra_without_cin7_id > 0 ? (
                <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {snapshot.optix.customers.extra_without_cin7_id} Optix customers have no Cin7 id —
                  these are legacy CRM records. Sync adds Cin7-linked rows; it does not merge or
                  backfill IDs onto existing Optix-only customers (Phase 1: no
                  merge/delete/cleanse).
                </p>
              ) : null}

              {snapshot.notes.map((note) => (
                <p key={note} className="text-muted-foreground text-xs">
                  {note}
                </p>
              ))}

              {snapshot.sync_completeness?.some((row) => row.likely_incomplete) ? (
                <div className="border-border/50 space-y-1 border-t pt-2">
                  <p className="text-muted-foreground text-[11px] font-medium">
                    Sync short vs Cin7 — click Continue on that entity
                  </p>
                  {snapshot.sync_completeness
                    .filter((row) => row.likely_incomplete)
                    .map((row) => (
                      <p
                        key={row.entity}
                        className="text-[11px] leading-snug text-amber-700/90 dark:text-amber-400/90"
                      >
                        {row.label}: {row.note ?? 'Incomplete — click Continue to finish.'}
                      </p>
                    ))}
                </div>
              ) : null}
            </div>

            <Tabs
              value={exceptionEntity}
              onValueChange={(v) => {
                setExceptionEntity(v as Cin7ExceptionEntity);
                setExceptions([]);
                setExceptionTotal(0);
                setExceptionOffset(0);
              }}
            >
              <TabsList className="flex h-auto max-h-32 flex-wrap gap-1 overflow-y-auto">
                {EXCEPTION_ENTITIES.map(({ key, label }) => (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {EXCEPTION_ENTITIES.map(({ key }) => (
                <TabsContent key={key} value={key} className="mt-3">
                  {exceptionsLoading && exceptionEntity === key ? (
                    <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building exception report from live Cin7…
                    </div>
                  ) : exceptions.length === 0 || exceptionEntity !== key ? (
                    <p className="text-muted-foreground py-4 text-sm">
                      Click &quot;Load exception report&quot; to list records that differ between
                      Cin7 and Optix for {key.replace(/-/g, ' ')}.
                    </p>
                  ) : (
                    <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-muted-foreground text-xs">
                          Showing {exceptions.length} of {exceptionTotal} exception(s)
                        </p>
                        <div className="flex gap-2">
                          {exceptions.length < exceptionTotal ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={exceptionsLoading}
                              onClick={() =>
                                void loadExceptions(exceptionEntity, exceptionOffset, true)
                              }
                            >
                              Load more
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                            <a href={getCin7ExceptionReportExportUrl(exceptionEntity)} download>
                              Export CSV
                            </a>
                          </Button>
                        </div>
                      </div>
                      {exceptions.map((row, idx) => (
                        <div
                          key={`${row.cin7_id}-${row.reason}-${idx}`}
                          className="border-border/60 bg-background/50 rounded-md border px-3 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{row.label}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {reasonLabel(row.reason)}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-0.5 font-mono">{row.cin7_id}</p>
                          {row.skipped_reason ? (
                            <p className="text-muted-foreground mt-1">
                              Reason: {row.skipped_reason}
                            </p>
                          ) : null}
                          {Array.isArray(row.fields)
                            ? row.fields.map((f) => (
                                <p key={f.field} className="text-muted-foreground mt-1">
                                  <span className="text-foreground">{f.field}:</span> Cin7 &quot;
                                  {f.cin7_value}&quot; · Optix &quot;{f.optix_value}&quot;
                                </p>
                              ))
                            : null}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        ) : isRefreshing ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading reconciliation from Cin7… this can take a few minutes on first run.
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            {isConnected
              ? 'Open a stored snapshot above, or run the acceptance gate for a sign-off number. Live measurement is optional and not used for close-out.'
              : 'Connect Cin7 to run reconciliation.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
