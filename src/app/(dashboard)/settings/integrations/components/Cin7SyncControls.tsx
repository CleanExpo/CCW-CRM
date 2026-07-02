"use client";

import { useState } from "react";
import { RefreshCw, Package, Users, ShoppingCart, Boxes } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { triggerCin7Sync, triggerCin7Poll } from "@/lib/api/cin7";

interface Cin7SyncControlsProps {
  isConnected: boolean;
}

const SYNC_ENTITIES = [
  { key: "products" as const, label: "Products", icon: Package, color: "text-blue-600" },
  { key: "customers" as const, label: "Customers", icon: Users, color: "text-green-600" },
  { key: "orders" as const, label: "Orders", icon: ShoppingCart, color: "text-purple-600" },
  { key: "inventory" as const, label: "Inventory", icon: Boxes, color: "text-orange-600" },
];

export function Cin7SyncControls({ isConnected }: Cin7SyncControlsProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [polling, setPolling] = useState(false);

  const handleSync = async (entityType: "products" | "customers" | "orders" | "inventory") => {
    setSyncing((prev) => ({ ...prev, [entityType]: true }));
    try {
      const result = await triggerCin7Sync(entityType);
      toast({
        title: "Sync Complete",
        description: `${entityType} sync completed. ${result.records_processed ?? 0} records processed.`,
      });
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
            <CardDescription>Manually trigger sync for each entity type (full Cin7 pull — all pages)</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePoll}
            disabled={polling}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${polling ? "animate-spin" : ""}`} />
            {polling ? "Polling..." : "Poll Changes"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
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
      </CardContent>
    </Card>
  );
}
