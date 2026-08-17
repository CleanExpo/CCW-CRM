'use client';

import {
  BadgePercent,
  Boxes,
  Building2,
  FolderTree,
  History,
  MapPin,
  Package,
  Receipt,
  RefreshCw,
  Ruler,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  getCin7SyncLogs,
  syncCin7EntityUntilComplete,
  triggerCin7Poll,
  type Cin7ScheduledSyncStatus,
  type Cin7SyncLog,
} from '@/lib/api/cin7';
import { toCin7SyncDisplayStatus } from '@/lib/integrations/cin7-sync-display';

import { Cin7ScheduledSyncRunner } from './Cin7ScheduledSyncRunner';

interface Cin7SyncControlsProps {
  isConnected: boolean;
}

type Cin7SyncEntityKey =
  | 'products'
  | 'customers'
  | 'internal-customers'
  | 'suppliers'
  | 'branches'
  | 'warehouses'
  | 'product-categories'
  | 'brands'
  | 'price-lists'
  | 'tax-codes'
  | 'units-of-measure'
  | 'stock-levels'
  | 'orders'
  | 'inventory';

const SYNC_ENTITIES: {
  key: Cin7SyncEntityKey;
  label: string;
  icon: typeof Package;
  color: string;
}[] = [
  { key: 'products', label: 'Products', icon: Package, color: 'text-blue-600' },
  { key: 'customers', label: 'Customers', icon: Users, color: 'text-green-600' },
  {
    key: 'internal-customers',
    label: 'Internal',
    icon: Building2,
    color: 'text-teal-600',
  },
  { key: 'suppliers', label: 'Suppliers', icon: Truck, color: 'text-amber-600' },
  { key: 'branches', label: 'Branches', icon: MapPin, color: 'text-indigo-600' },
  { key: 'warehouses', label: 'Warehouses', icon: Warehouse, color: 'text-indigo-500' },
  { key: 'product-categories', label: 'Categories', icon: FolderTree, color: 'text-cyan-600' },
  { key: 'brands', label: 'Brands', icon: Tags, color: 'text-pink-600' },
  { key: 'price-lists', label: 'Price lists', icon: BadgePercent, color: 'text-violet-600' },
  { key: 'tax-codes', label: 'Tax codes', icon: Receipt, color: 'text-rose-600' },
  { key: 'units-of-measure', label: 'UOM', icon: Ruler, color: 'text-lime-600' },
  { key: 'stock-levels', label: 'Stock', icon: Boxes, color: 'text-orange-600' },
  { key: 'orders', label: 'Orders', icon: ShoppingCart, color: 'text-purple-600' },
  // inventory aliases stock-levels on the server; kept as its own sync/history row.
  { key: 'inventory', label: 'Inventory', icon: Boxes, color: 'text-orange-500' },
];

/** Always shown in Recent sync (includes Orders + Inventory). */
const RECENT_SYNC_ENTITIES = SYNC_ENTITIES;

function labelForEntity(entityType: string): string {
  return SYNC_ENTITIES.find((e) => e.key === entityType)?.label ?? entityType.replace(/-/g, ' ');
}

function formatLogTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isContactEntity(entityType: Cin7SyncEntityKey): boolean {
  return (
    entityType === 'customers' || entityType === 'internal-customers' || entityType === 'suppliers'
  );
}

export function Cin7SyncControls({ isConnected }: Cin7SyncControlsProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [polling, setPolling] = useState(false);
  const [scheduledBusy, setScheduledBusy] = useState(false);
  const [logsByEntity, setLogsByEntity] = useState<Record<string, Cin7SyncLog>>({});
  const [logsLoading, setLogsLoading] = useState(false);

  const anySyncing = Object.values(syncing).some(Boolean);
  const syncActionsLocked = anySyncing || polling || scheduledBusy;

  const loadLogs = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLogsLoading(true);
    try {
      const { logs: recent } = await getCin7SyncLogs();
      const next: Record<string, Cin7SyncLog> = {};
      for (const log of recent) {
        next[log.entity_type] = log;
      }
      setLogsByEntity(next);
    } catch {
      // Non-blocking — sync controls still work without history
    } finally {
      if (!opts?.silent) setLogsLoading(false);
    }
  }, []);

  const applyLiveScheduledStatus = useCallback((status: Cin7ScheduledSyncStatus) => {
    const live = status.live_entities ?? [];
    if (live.length === 0) return;
    setLogsByEntity((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of live) {
        const existing = next[row.entity];
        if (existing?.status === row.status && existing?.records_processed === row.records) {
          continue;
        }
        changed = true;
        next[row.entity] = {
          id: existing?.id ?? `live-${row.entity}`,
          entity_type: row.entity,
          direction: existing?.direction ?? 'pull',
          status: row.status,
          records_processed: row.records,
          synced_at: row.updated_at || existing?.synced_at || null,
          error_message: existing?.error_message,
        };
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (isConnected) {
      void loadLogs();
    }
  }, [isConnected, loadLogs]);

  const summary = useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    for (const { key } of RECENT_SYNC_ENTITIES) {
      const status = toCin7SyncDisplayStatus(logsByEntity[key]?.status);
      if (status === 'complete') complete += 1;
      else incomplete += 1;
    }
    return { complete, incomplete, total: RECENT_SYNC_ENTITIES.length };
  }, [logsByEntity]);

  const handleSync = async (
    entityType: Cin7SyncEntityKey,
    options?: { forceRestart?: boolean }
  ) => {
    if (syncActionsLocked) return;
    setSyncing((prev) => ({ ...prev, [entityType]: true }));
    const label = labelForEntity(entityType);
    try {
      const prior = logsByEntity[entityType];
      const displayStatus = toCin7SyncDisplayStatus(prior?.status);
      // Resume incomplete; restart only after a completed sync (or forced).
      const restart = options?.forceRestart === true || !prior || displayStatus === 'complete';

      const result = await syncCin7EntityUntilComplete(entityType, {
        restart,
        full: isContactEntity(entityType) || options?.forceRestart === true,
        maxRounds: isContactEntity(entityType) ? 60 : 30,
        maxChunksPerRound: 8,
        onProgress: () => {
          void loadLogs();
        },
      });

      const durationSec =
        result.duration_ms != null ? (result.duration_ms / 1000).toFixed(1) : null;
      const count = result.records_processed ?? 0;
      const rateLimited = (result.sync_errors ?? []).some((e) => /429|rate-?limit/i.test(e));

      if (result.status === 'running') {
        toast({
          title: 'Sync already in progress',
          description: `${label} is already syncing. Wait a moment, then refresh.`,
        });
        await loadLogs();
        return;
      }

      const incomplete = result.status === 'incomplete' || result.complete === false;
      if (incomplete) {
        toast({
          variant: rateLimited ? 'destructive' : 'default',
          title: rateLimited ? 'Cin7 rate-limited — sync incomplete' : 'Sync incomplete',
          description:
            result.completeness_message ||
            result.sync_errors?.slice(0, 2).join(' ') ||
            `${label} paused at ${count.toLocaleString()} records. Click Continue to finish.`,
        });
      } else {
        toast({
          title: 'Sync complete',
          description: `${label} is up to date — ${count.toLocaleString()} records${
            durationSec ? ` in ${durationSec}s` : ''
          }.`,
        });
      }
      await loadLogs();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Sync incomplete',
        description:
          error instanceof Error
            ? error.message
            : `Could not finish ${label}. Click Continue to resume.`,
      });
      await loadLogs();
    } finally {
      setSyncing((prev) => ({ ...prev, [entityType]: false }));
    }
  };

  const handlePoll = async () => {
    if (syncActionsLocked) return;
    setPolling(true);
    try {
      const result = await triggerCin7Poll('core');
      toast({
        title: 'Poll complete',
        description: `Found ${result.total_changes} changes in ${result.duration_ms}ms`,
      });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Poll incomplete',
        description: error instanceof Error ? error.message : 'Could not poll for changes',
      });
    } finally {
      setPolling(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Cin7 Sync Controls
          </CardTitle>
          <CardDescription>Connect to Cin7 to enable sync controls</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Cin7 Sync Controls
            </CardTitle>
            <CardDescription>
              Sync each master-data entity from Cin7. Incomplete runs resume from a checkpoint —
              nothing already imported is removed.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handlePoll()}
            disabled={syncActionsLocked}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${polling ? 'animate-spin' : ''}`} />
            {polling ? 'Polling…' : 'Poll changes'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Cin7ScheduledSyncRunner
          isConnected={isConnected}
          manualBusy={anySyncing || polling}
          onScheduledBusyChange={setScheduledBusy}
          onLiveEntities={applyLiveScheduledStatus}
          onLogsMayHaveChanged={() => {
            void loadLogs({ silent: true });
          }}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SYNC_ENTITIES.map(({ key, label, icon: Icon, color }) => {
            const isSyncing = syncing[key] ?? false;
            const displayStatus = toCin7SyncDisplayStatus(logsByEntity[key]?.status);
            const needsContinue = !isSyncing && displayStatus === 'incomplete';
            return (
              <Button
                key={key}
                variant="outline"
                className="h-auto flex-col gap-2 py-4"
                onClick={() => void handleSync(key)}
                disabled={syncActionsLocked}
              >
                <Icon className={`h-5 w-5 ${isSyncing ? 'animate-spin' : color}`} />
                <span className="text-xs font-medium">
                  {isSyncing
                    ? `Syncing ${label}…`
                    : needsContinue
                      ? `Continue ${label}`
                      : `Sync ${label}`}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="border-border/60 bg-muted/20 rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                <History className="h-3.5 w-3.5 shrink-0" />
                Recent sync
              </span>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {summary.complete === summary.total
                  ? 'All entities complete'
                  : `${summary.complete} complete · ${summary.incomplete} incomplete`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 text-xs"
              disabled={logsLoading || syncActionsLocked}
              onClick={() => void loadLogs()}
            >
              {logsLoading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>
          <ul className="space-y-1.5">
            {RECENT_SYNC_ENTITIES.map(({ key, label }) => {
              const log = logsByEntity[key];
              const isSyncing = syncing[key] ?? false;
              const displayStatus = toCin7SyncDisplayStatus(log?.status);
              const count = log?.records_processed ?? 0;
              const statusTone =
                displayStatus === 'complete'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400';
              const shortMsg =
                displayStatus === 'incomplete' && log?.error_message ? log.error_message : null;
              return (
                <li key={key} className="space-y-0.5 text-xs tabular-nums">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0 font-medium">{label}</span>
                    <span className="text-right">
                      {isSyncing ? (
                        <span className="text-amber-600 dark:text-amber-400">Syncing…</span>
                      ) : (
                        <>
                          <span className={`font-medium capitalize ${statusTone}`}>
                            {displayStatus}
                          </span>
                          <span className="text-muted-foreground">
                            {' · '}
                            {count.toLocaleString()}
                            {' · '}
                            {formatLogTime(log?.synced_at)}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  {shortMsg && !isSyncing ? (
                    <p className="text-[11px] leading-snug text-amber-700/90 dark:text-amber-400/90">
                      {shortMsg}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {summary.incomplete > 0 && !anySyncing && (
            <p className="text-muted-foreground border-border/50 mt-2 border-t pt-2 text-[11px] leading-relaxed">
              Incomplete means the sync paused (time budget or Cin7 rate limit). Click{' '}
              <span className="text-foreground/80 font-medium">Continue</span> on that entity — it
              resumes from the last saved page.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
