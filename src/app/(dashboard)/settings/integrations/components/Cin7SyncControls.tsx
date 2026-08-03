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
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  getCin7SyncLogs,
  triggerCin7Poll,
  triggerCin7Sync,
  type Cin7SyncLog,
} from '@/lib/api/cin7';

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

function formatLogTime(iso: string | null | undefined): string {
  if (!iso) return 'Never synced';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
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
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected) {
      void loadLogs();
    }
  }, [isConnected, loadLogs]);

  const handleSync = async (
    entityType: Cin7SyncEntityKey,
    options?: { forceRestart?: boolean }
  ) => {
    if (syncActionsLocked) return;
    setSyncing((prev) => ({ ...prev, [entityType]: true }));
    try {
      const prior = logsByEntity[entityType];
      // Resume incomplete/running; only restart when never synced, complete, failed, or forced.
      const restart =
        options?.forceRestart === true ||
        !prior ||
        prior.status === 'never' ||
        prior.status === 'complete' ||
        prior.status === 'failed' ||
        prior.status === 'idle';
      // Contact entities: always full catalog walk (Omni type filter under-counts; deltas won't backfill).
      const contactFull =
        entityType === 'customers' ||
        entityType === 'internal-customers' ||
        entityType === 'suppliers';
      const result = await triggerCin7Sync(entityType, {
        restart,
        full: contactFull || options?.forceRestart === true,
        maxChunks: 4,
      });
      const durationSec =
        result.duration_ms != null ? (result.duration_ms / 1000).toFixed(1) : null;
      const count = result.records_processed ?? 0;
      const rateLimited = (result.sync_errors ?? []).some((e) => /429|rate-?limit/i.test(e));
      if (result.status === 'running') {
        toast({
          title: 'Sync already running',
          description:
            result.sync_errors?.[0] ||
            `${entityType} is already syncing. Wait for it to finish, then refresh.`,
        });
        await loadLogs();
        return;
      }
      const failed =
        result.status === 'failed' ||
        result.status === 'error' ||
        (result.complete === false && result.failed_page != null);
      const incomplete = result.status === 'incomplete' || result.complete === false;
      const failedEmpty =
        count === 0 && (failed || incomplete || (result.sync_errors?.length ?? 0) > 0);

      if (failed || failedEmpty) {
        toast({
          variant: 'destructive',
          title: rateLimited ? 'Cin7 rate-limited' : failed ? 'Sync failed' : 'Sync incomplete',
          description:
            result.sync_errors?.slice(0, 2).join(' ') ||
            `${entityType}: ${result.status}${
              result.failed_page != null ? ` (page ${result.failed_page})` : ''
            }. ${count} records. Click Sync again to resume from page ${result.next_page ?? '—'}.`,
        });
      } else if (incomplete) {
        toast({
          title: 'Sync paused — click again to continue',
          description: `${entityType} paused at page ${result.next_page ?? '—'}. ${count} records stored. Resume continues from the checkpoint (not page 1).`,
        });
      } else {
        toast({
          title: 'Sync Complete',
          description: `${entityType} sync completed. ${count} records in ${durationSec ?? '—'}s.`,
        });
      }
      await loadLogs();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : `Failed to sync ${entityType}`,
      });
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
        title: 'Poll Complete',
        description: `Found ${result.total_changes} changes in ${result.duration_ms}ms`,
      });
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Poll Failed',
        description: error instanceof Error ? error.message : 'Failed to poll for changes',
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Cin7 Sync Controls
            </CardTitle>
            <CardDescription>
              Manually trigger sync for each entity type (one at a time — full Cin7 pull)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handlePoll()}
            disabled={syncActionsLocked}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${polling ? 'animate-spin' : ''}`} />
            {polling ? 'Polling...' : 'Poll Changes'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Cin7ScheduledSyncRunner
          isConnected={isConnected}
          manualBusy={anySyncing || polling}
          onScheduledBusyChange={setScheduledBusy}
          onLogsMayHaveChanged={() => {
            void loadLogs();
          }}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SYNC_ENTITIES.map(({ key, label, icon: Icon, color }) => {
            const isSyncing = syncing[key] ?? false;
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
                  {isSyncing ? `Syncing ${label}...` : `Sync ${label}`}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="border-border/60 bg-muted/20 rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
              <History className="h-3.5 w-3.5" />
              Recent sync
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
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
              const neverSynced = !log || log.status === 'never';
              const status = log?.status ?? 'never';
              // idle = run row exists but never finished; show clearer label than raw "idle".
              const statusLabel =
                status === 'idle'
                  ? log && log.records_processed > 0
                    ? 'stopped'
                    : 'not started'
                  : status;
              const statusTone =
                status === 'complete'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : status === 'failed'
                    ? 'text-destructive'
                    : status === 'incomplete' || status === 'running' || status === 'idle'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground';
              const failPageNote =
                (status === 'failed' || status === 'incomplete') && log?.failed_page != null
                  ? ` · fail p${log.failed_page}`
                  : '';
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-2 text-xs tabular-nums"
                >
                  <span className="text-muted-foreground shrink-0 font-medium">Sync {label}</span>
                  <span className="text-right">
                    {isSyncing ? (
                      <span className="text-amber-600 dark:text-amber-400">Syncing…</span>
                    ) : neverSynced ? (
                      <span className="text-muted-foreground">Not synced yet</span>
                    ) : (
                      <>
                        <span className={statusTone}>{statusLabel}</span>
                        {' · '}
                        {log.records_processed.toLocaleString()}
                        {failPageNote}
                        {' · '}
                        {formatLogTime(log.synced_at)}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
