"use client";

import { useState, useEffect, memo } from "react";
import { Activity, Package, Users, ShoppingCart, Boxes, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api/client";
import { useCin7Stream, type Cin7SyncEvent } from "@/hooks/use-cin7-stream";
import { getCin7SyncHealth, type Cin7SyncHealth } from "@/lib/api/cin7";
import Link from "next/link";

const ENTITY_CONFIG: Record<string, { icon: typeof Package; color: string }> = {
  product: { icon: Package, color: "text-blue-600" },
  customer: { icon: Users, color: "text-green-600" },
  sales: { icon: ShoppingCart, color: "text-purple-600" },
  inventory: { icon: Boxes, color: "text-orange-600" },
};

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800 border-green-300",
  B: "bg-blue-100 text-blue-800 border-blue-300",
  C: "bg-yellow-100 text-yellow-800 border-yellow-300",
  D: "bg-orange-100 text-orange-800 border-orange-300",
  F: "bg-red-100 text-red-800 border-red-300",
};

export const Cin7SyncStatusWidget = memo(function Cin7SyncStatusWidget() {
  const [health, setHealth] = useState<Cin7SyncHealth | null>(null);
  const [recentEvents, setRecentEvents] = useState<Cin7SyncEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: sseEvent, status: sseStatus } = useCin7Stream(true);

  // Fetch initial health data
  useEffect(() => {
    async function fetchHealth() {
      try {
        setLoading(true);
        const healthData = await getCin7SyncHealth();
        setHealth(healthData);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load sync health");
      } finally {
        setLoading(false);
      }
    }

    fetchHealth();
  }, []);

  // Accumulate SSE events
  useEffect(() => {
    if (sseEvent) {
      setRecentEvents((prev) => [sseEvent, ...prev].slice(0, 10));
    }
  }, [sseEvent]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Cin7 Sync Status
          </CardTitle>
          <CardDescription>Loading sync health...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Cin7 Sync Status
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
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
              <Activity className="h-5 w-5" />
              Cin7 Sync Status
            </CardTitle>
            <CardDescription>
              Real-time sync activity and health
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {sseStatus === "connected" && (
              <Badge variant="outline" className="text-xs">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-1" />
                Live
              </Badge>
            )}
            {health && (
              <Badge
                variant="outline"
                className={`text-sm font-bold ${GRADE_COLORS[health.grade] ?? ""}`}
              >
                {health.grade} ({health.score})
              </Badge>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/integrations">Manage</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {health && (
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border p-2">
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="text-lg font-bold">{health.details.success_rate}%</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-xs text-muted-foreground">Avg Duration</p>
              <p className="text-lg font-bold">{Math.round(health.details.avg_duration_ms)}ms</p>
            </div>
            <div className="rounded-lg border p-2">
              <p className="text-xs text-muted-foreground">Total Syncs</p>
              <p className="text-lg font-bold">{health.details.total_syncs}</p>
            </div>
          </div>
        )}

        {recentEvents.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent Events
            </p>
            {recentEvents.slice(0, 5).map((event, idx) => {
              const config = ENTITY_CONFIG[event.entity_type] ?? { icon: Activity, color: "text-muted-foreground" };
              const Icon = config.icon;
              return (
                <div key={`${event.timestamp}-${idx}`} className="flex items-center gap-2 text-sm">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className="flex-1 truncate">
                    {event.entity_type} {event.action}
                    {event.records_affected ? ` (${event.records_affected} records)` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent sync events</p>
            <p className="text-xs mt-1">Events will appear here when Cin7 syncs occur</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
