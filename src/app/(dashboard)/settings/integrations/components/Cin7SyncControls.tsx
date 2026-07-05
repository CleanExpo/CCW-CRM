"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  Package,
  Users,
  ShoppingCart,
  Boxes,
  Truck,
  Building2,
  MapPin,
  History,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  getCin7SyncLogs,
  triggerCin7Sync,
  triggerCin7Poll,
  type Cin7SyncLog,
} from "@/lib/api/cin7";

interface Cin7SyncControlsProps {
  isConnected: boolean;
}

type Cin7SyncEntityKey =
  | "products"
  | "customers"
  | "internal-customers"
  | "suppliers"
  | "branches"
  | "orders"
  | "inventory";

const SYNC_ENTITIES: {
  key: Cin7SyncEntityKey;
  label: string;
  icon: typeof Package;
  color: string;
}[] = [
  { key: "products", label: "Products", icon: Package, color: "text-blue-600" },
  { key: "customers", label: "Customers", icon: Users, color: "text-green-600" },
  {
    key: "internal-customers",
    label: "Internal",
    icon: Building2,
    color: "text-teal-600",
  },
  { key: "suppliers", label: "Suppliers", icon: Truck, color: "text-amber-600" },
  { key: "branches", label: "Branches", icon: MapPin, color: "text-indigo-600" },
  { key: "orders", label: "Orders", icon: ShoppingCart, color: "text-purple-600" },
  { key: "inventory", label: "Inventory", icon: Boxes, color: "text-orange-600" },
];

function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
      toast({
        title: "Sync Complete",
        description: `${entityType} sync completed. ${result.records_processed ?? 0} records in ${durationSec ?? "—"}s.`,
      });
      await loadLogs();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Sync Failed",
        description: error instanceof Error ? error.message : `Failed to sync ${entityType}`,
      });
    } finally {
      setSyncing((prev) => ({ ...prev, [entityType]: false }));
    }
  };

  const handlePoll = async () => {
    setPolling(true);
    try {
      const result = await triggerCin7Poll("core");
      toast({
        title: "Poll Complete",
        description: `Found ${result.total_changes} changes in ${result.duration_ms}ms`,
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Poll Failed",
        description: error instanceof Error ? error.message : "Failed to poll for changes",
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
            <RefreshCw className={`mr-2 h-4 w-4 ${polling ? "animate-spin" : ""}`} />
            {polling ? "Polling..." : "Poll Changes"}
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
                <Icon className={`h-5 w-5 ${isSyncing ? "animate-spin" : color}`} />
                <span className="text-xs font-medium">
                  {isSyncing ? `Syncing ${label}...` : `Sync ${label}`}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="border-border/60 rounded-lg border bg-muted/20 p-3">
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
              {logsLoading ? "Loading…" : "Refresh"}
            </Button>
          </div>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-xs">No sync history yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between text-xs tabular-nums"
                >
                  <span className="text-muted-foreground capitalize">
                    {log.entity_type.replace(/-/g, " ")}
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
