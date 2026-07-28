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
  { key: 'inventory', label: 'Inventory', icon: Boxes, color: 'text-orange-500' },
];

function formatLogTime(iso: string): string {
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
  const [logs, setLogs] = useState<Cin7SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { logs: recent } = await getCin7SyncLogs(8);
      setLogs(recent);
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

  const handleSync = async (entityType: Cin7SyncEntityKey) => {
    setSyncing((prev) => ({ ...prev, [entityType]: true }));
    try {
      const result = await triggerCin7Sync(entityType);
      const durationSec =
        result.duration_ms != null ? (result.duration_ms / 1000).toFixed(1) : null;
      const count = result.records_processed ?? 0;
      const rateLimited = (result.sync_errors ?? []).some((e) => /429|rate-?limit/i.test(e));
      const failedEmpty =
        count === 0 &&
        (result.status === 'error' ||
          result.complete === false ||
          (result.sync_errors?.length ?? 0) > 0);

      if (failedEmpty) {
        toast({
          variant: 'destructive',
          title: rateLimited ? 'Cin7 rate-limited' : 'Sync returned no records',
          description:
            result.sync_errors?.slice(0, 2).join(' ') ||
            `${entityType} synced 0 records. Wait a minute and retry — Cin7 may be throttling or the request failed.`,
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
              Manually trigger sync for each entity type (full Cin7 pull — all pages)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handlePoll} disabled={polling}>
            <RefreshCw className={`mr-2 h-4 w-4 ${polling ? 'animate-spin' : ''}`} />
            {polling ? 'Polling...' : 'Poll Changes'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SYNC_ENTITIES.map(({ key, label, icon: Icon, color }) => {
            const isSyncing = syncing[key] ?? false;
            return (
              <Button
                key={key}
                variant="outline"
                className="h-auto flex-col gap-2 py-4"
                onClick={() => handleSync(key)}
                disabled={isSyncing}
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
              Recent sync runs
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={logsLoading}
              onClick={() => void loadLogs()}
            >
              {logsLoading ? 'Loading…' : 'Refresh'}
            </Button>
          </div>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-xs">No sync history yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-muted-foreground capitalize">
                    {log.entity_type.replace(/-/g, ' ')}
                  </span>
                  <span>
                    {log.records_processed.toLocaleString()} · {formatLogTime(log.synced_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
