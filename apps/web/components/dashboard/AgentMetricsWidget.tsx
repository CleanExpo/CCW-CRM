"use client";

import { memo } from "react";
import { Bot, AlertTriangle, CheckCircle2, XCircle, Activity, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAutonomyMetrics } from "@/lib/hooks/use-autonomy-metrics";

const STATUS_STYLES: Record<string, { color: string; bgColor: string; label: string }> = {
  healthy: { color: "text-green-600", bgColor: "bg-green-100 border-green-300", label: "Healthy" },
  degraded: { color: "text-yellow-600", bgColor: "bg-yellow-100 border-yellow-300", label: "Degraded" },
  unhealthy: { color: "text-red-600", bgColor: "bg-red-100 border-red-300", label: "Unhealthy" },
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const AgentMetricsWidget = memo(function AgentMetricsWidget() {
  const { metrics, health, anomalies, loading, error } = useAutonomyMetrics(24);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agent Performance
          </CardTitle>
          <CardDescription>Loading agent metrics...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agent Performance
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const statusStyle = STATUS_STYLES[health?.status ?? "healthy"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Agent Performance
            </CardTitle>
            <CardDescription>24h autonomous agent metrics</CardDescription>
          </div>
          {health && (
            <Badge variant="outline" className={`text-sm font-bold ${statusStyle.bgColor}`}>
              {statusStyle.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {metrics && (
          <>
            {/* Key Metrics Grid */}
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className={`text-lg font-bold ${metrics.auto_merge_success_rate >= 0.9 ? "text-green-600" : metrics.auto_merge_success_rate >= 0.7 ? "text-yellow-600" : "text-red-600"}`}>
                  {formatPercent(metrics.auto_merge_success_rate)}
                </p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">Test Pass</p>
                <p className={`text-lg font-bold ${metrics.test_pass_rate >= 0.95 ? "text-green-600" : metrics.test_pass_rate >= 0.8 ? "text-yellow-600" : "text-red-600"}`}>
                  {formatPercent(metrics.test_pass_rate)}
                </p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="text-xs text-muted-foreground">Avg Duration</p>
                <p className="text-lg font-bold">{formatDuration(metrics.avg_duration_ms)}</p>
              </div>
            </div>

            {/* Action Summary */}
            <div className="space-y-2 mb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions (24h)
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">{metrics.total_actions}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-muted-foreground">Merged:</span>
                  <span className="font-medium">{metrics.total_auto_merged}</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                  <span className="text-muted-foreground">Rejected:</span>
                  <span className="font-medium">{metrics.total_rejected}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-orange-600" />
                  <span className="text-muted-foreground">Blocked:</span>
                  <span className="font-medium">{metrics.total_blocked}</span>
                </div>
              </div>
            </div>

            {/* Risk Distribution */}
            {Object.keys(metrics.risk_distribution).length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Risk Distribution
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(metrics.risk_distribution).map(([level, count]) => (
                    <Badge key={level} variant="secondary" className="text-xs">
                      {level}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Anomalies */}
        {anomalies && anomalies.has_anomalies && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-destructive uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Anomalies Detected ({anomalies.anomaly_count})
            </p>
            <div className="space-y-1">
              {anomalies.anomalies.slice(0, 3).map((anomaly, idx) => (
                <p key={idx} className="text-xs text-destructive/80 truncate">
                  {anomaly}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* No data state */}
        {metrics && metrics.total_actions === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No agent activity</p>
            <p className="text-xs mt-1">Metrics will appear when agents execute tasks</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
