"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity, AlertCircle, TrendingUp, Zap } from "lucide-react";
import {
  getPerformanceStats,
  getSlowestEndpoints,
  getErrorEndpoints,
  type PerformanceStats as PerformanceStatsType,
  type EndpointStats,
} from "@/lib/api/monitoring";

export function ApiPerformance() {
  const [stats, setStats] = useState<PerformanceStatsType | null>(null);
  const [slowest, setSlowest] = useState<EndpointStats[]>([]);
  const [errors, setErrors] = useState<EndpointStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Refresh every 15 seconds
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [statsData, slowestData, errorsData] = await Promise.all([
        getPerformanceStats(),
        getSlowestEndpoints(10),
        getErrorEndpoints(1.0),
      ]);

      setStats(statsData);
      setSlowest(slowestData.endpoints);
      setErrors(errorsData.endpoints);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load performance data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading performance data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Total Requests"
          value={stats.total_requests.toLocaleString()}
          status="neutral"
        />
        <MetricCard
          icon={AlertCircle}
          label="Error Rate"
          value={`${stats.overall_error_rate.toFixed(2)}%`}
          subtext={`${stats.total_errors} errors`}
          status={
            stats.overall_error_rate > 5
              ? "critical"
              : stats.overall_error_rate > 1
              ? "warning"
              : "good"
          }
        />
        <MetricCard
          icon={Zap}
          label="Avg Response Time"
          value={`${stats.avg_response_time_ms.toFixed(0)}ms`}
          status={
            stats.avg_response_time_ms > 1000
              ? "warning"
              : stats.avg_response_time_ms > 2000
              ? "critical"
              : "good"
          }
        />
        <MetricCard
          icon={TrendingUp}
          label="P95 Response Time"
          value={`${stats.p95_response_time_ms.toFixed(0)}ms`}
          status={
            stats.p95_response_time_ms > 2000
              ? "critical"
              : stats.p95_response_time_ms > 1000
              ? "warning"
              : "good"
          }
        />
      </div>

      {/* Slowest Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle>Slowest Endpoints (Top 10)</CardTitle>
          <CardDescription>Ranked by P95 response time</CardDescription>
        </CardHeader>
        <CardContent>
          {slowest.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No endpoint data available yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Avg (ms)</TableHead>
                  <TableHead className="text-right">P95 (ms)</TableHead>
                  <TableHead className="text-right">Error Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slowest.map((endpoint, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-xs">{endpoint.endpoint}</TableCell>
                    <TableCell className="text-right">{endpoint.request_count}</TableCell>
                    <TableCell className="text-right">
                      <ResponseTimeBadge ms={endpoint.avg_response_time_ms} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ResponseTimeBadge ms={endpoint.p95_response_time_ms} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ErrorRateBadge rate={endpoint.error_rate} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Error Endpoints */}
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>High Error Rate Endpoints</CardTitle>
            <CardDescription>Endpoints with error rate {'>'} 1%</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                  <TableHead className="text-right">Error Rate</TableHead>
                  <TableHead className="text-right">P95 (ms)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((endpoint, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-xs">{endpoint.endpoint}</TableCell>
                    <TableCell className="text-right">{endpoint.request_count}</TableCell>
                    <TableCell className="text-right">{endpoint.error_count}</TableCell>
                    <TableCell className="text-right">
                      <ErrorRateBadge rate={endpoint.error_rate} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ResponseTimeBadge ms={endpoint.p95_response_time_ms} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  status,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  subtext?: string;
  status: "good" | "warning" | "critical" | "neutral";
}) {
  const statusColor = {
    good: "text-green-600",
    warning: "text-yellow-600",
    critical: "text-red-600",
    neutral: "text-foreground",
  }[status];

  const bgColor = {
    good: "bg-green-500/10",
    warning: "bg-yellow-500/10",
    critical: "bg-red-500/10",
    neutral: "bg-muted",
  }[status];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`rounded p-1.5 ${bgColor}`}>
            <Icon className={`h-4 w-4 ${statusColor}`} />
          </div>
          <span className="text-xs text-muted-foreground truncate">{label}</span>
        </div>
        <p className={`text-xl font-semibold ${statusColor}`}>{value}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function ResponseTimeBadge({ ms }: { ms: number }) {
  const variant =
    ms > 2000 ? "destructive" : ms > 1000 ? "secondary" : "outline";

  return (
    <Badge variant={variant} className="text-xs">
      {ms.toFixed(0)}ms
    </Badge>
  );
}

function ErrorRateBadge({ rate }: { rate: number }) {
  const variant =
    rate > 5 ? "destructive" : rate > 1 ? "secondary" : "outline";

  return (
    <Badge variant={variant} className="text-xs">
      {rate.toFixed(1)}%
    </Badge>
  );
}
