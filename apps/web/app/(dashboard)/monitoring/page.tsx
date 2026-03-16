'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Activity,
  Database,
  HardDrive,
  Server,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gauge,
  MemoryStick,
  Zap,
  ArrowUpDown,
} from 'lucide-react';
import { BusinessMetrics } from './components/BusinessMetrics';
import { ApiPerformance } from './components/ApiPerformance';
import { AlertCard } from './components/AlertCard';
import {
  getHealth,
  getMetrics,
  getPrometheusAlerts,
  getRangeData,
  getAlerts,
} from '@/lib/api/monitoring';

// ─── Types ─────────────────────────────────────────────────────

interface ServiceStatus {
  job: string;
  health: 'up' | 'down' | 'unknown';
  lastScrape: string;
  lastError: string;
}

interface Metrics {
  [key: string]: number | null;
}

interface PrometheusAlert {
  name: string;
  severity: string;
  state: string;
  summary: string;
  description: string;
  activeAt: string;
  value: string;
}

interface SystemAlert {
  id: number;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  resolved: boolean;
  resolved_at?: string;
}

interface TimeSeriesPoint {
  time: string;
  timestamp: number;
  value: number;
}

interface ChartDataPoint {
  time: string;
  [key: string]: string | number;
}

// ─── Helpers ───────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (bytes === null || isNaN(bytes)) return 'N/A';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatNumber(val: number | null, decimals = 1): string {
  if (val === null || isNaN(val)) return 'N/A';
  return val.toFixed(decimals);
}

function formatPercent(val: number | null): string {
  if (val === null || isNaN(val)) return 'N/A';
  return (val * 100).toFixed(1) + '%';
}

function formatUptime(seconds: number | null): string {
  if (seconds === null || isNaN(seconds)) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

const SERVICE_LABELS: Record<string, { label: string; icon: typeof Database }> = {
  postgres: { label: 'PostgreSQL', icon: Database },
  redis: { label: 'Redis', icon: HardDrive },
  'ccw-backend': { label: 'Backend API', icon: Server },
  prometheus: { label: 'Prometheus', icon: Activity },
};

// ─── Component ─────────────────────────────────────────────────

export default function MonitoringPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({});
  const [prometheusAlerts, setPrometheusAlerts] = useState<PrometheusAlert[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [alertSummary, setAlertSummary] = useState({ total_rules: 0, firing: 0, pending: 0 });
  const [prometheusStatus, setPrometheusStatus] = useState<'up' | 'down'>('down');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [duration, setDuration] = useState('1h');

  // Time-series chart data
  const [pgConnectionsData, setPgConnectionsData] = useState<ChartDataPoint[]>([]);
  const [redisMemoryData, setRedisMemoryData] = useState<ChartDataPoint[]>([]);
  const [redisOpsData, setRedisOpsData] = useState<ChartDataPoint[]>([]);
  const [pgOpsData, setPgOpsData] = useState<ChartDataPoint[]>([]);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);

      // Fetch all data in parallel
      const [healthData, metricsData, alertsData] = await Promise.all([
        getHealth(),
        getMetrics(),
        getPrometheusAlerts(),
      ]);

      setServices(healthData.services || []);
      setPrometheusStatus(healthData.prometheus || 'down');
      setMetrics(metricsData.metrics || {});
      setPrometheusAlerts(alertsData.alerts || []);
      setAlertSummary(alertsData.summary || { total_rules: 0, firing: 0, pending: 0 });
      setLastUpdated(new Date().toLocaleTimeString('en-AU'));

      // Fetch system alerts (unresolved only)
      try {
        const systemAlertsData = await getAlerts({ acknowledged: false });
        setSystemAlerts(systemAlertsData.alerts || []);
      } catch (error) {
        console.error('Failed to fetch system alerts:', error);
      }

      // Fetch chart data
      const step = duration === '1h' ? '15' : duration === '6h' ? '60' : '300';
      const chartQueries = [
        { key: 'pg_connections', query: 'sum(pg_stat_activity_count)' },
        { key: 'redis_memory', query: 'redis_memory_used_bytes' },
        { key: 'redis_ops', query: 'rate(redis_commands_processed_total[5m])' },
        { key: 'pg_ops', query: 'rate(pg_stat_database_xact_commit{datname="starter_db"}[5m])' },
      ];

      const chartResults = await Promise.allSettled(
        chartQueries.map((q) => getRangeData({ query: q.query, duration, step }))
      );

      const toChartData = (
        result: PromiseSettledResult<{ series?: Array<{ values?: TimeSeriesPoint[] }> }>
      ): ChartDataPoint[] => {
        if (result.status !== 'fulfilled') return [];
        const values = result.value?.series?.[0]?.values || [];
        return values.map((v: TimeSeriesPoint) => ({
          time: formatTime(v.time),
          value: v.value,
        }));
      };

      setPgConnectionsData(toChartData(chartResults[0]));
      setRedisMemoryData(
        chartResults[1].status === 'fulfilled'
          ? (chartResults[1].value?.series?.[0]?.values || []).map((v: TimeSeriesPoint) => ({
              time: formatTime(v.time),
              value: v.value / (1024 * 1024), // Convert to MB
            }))
          : []
      );
      setRedisOpsData(toChartData(chartResults[2]));
      setPgOpsData(toChartData(chartResults[3]));
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [duration]);

  // Initial load and auto-refresh
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchData, 15000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  const pgConnectionPct =
    metrics.pg_connections && metrics.pg_max_connections
      ? (metrics.pg_connections / metrics.pg_max_connections) * 100
      : null;

  const redisMemoryPct =
    metrics.redis_memory_used && metrics.redis_memory_max && metrics.redis_memory_max > 0
      ? (metrics.redis_memory_used / metrics.redis_memory_max) * 100
      : null;

  return (
    <div className="space-y-6 p-6">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Infrastructure health and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="bg-background rounded-md border px-3 py-1.5 text-sm"
          >
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'border-green-500 text-green-600' : ''}
          >
            {autoRefresh ? (
              <Wifi className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <WifiOff className="mr-1.5 h-3.5 w-3.5" />
            )}
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={refreshing}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {lastUpdated && (
            <span className="text-muted-foreground text-xs">Updated {lastUpdated}</span>
          )}
        </div>
      </div>

      {/* ─── Service Health ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(SERVICE_LABELS).map(([job, { label, icon: Icon }]) => {
          const service = services.find((s) => s.job === job);
          const isUp = service?.health === 'up';
          const isDown = service?.health === 'down';
          return (
            <Card key={job} className="relative overflow-hidden">
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`rounded-lg p-2 ${
                    isUp
                      ? 'bg-green-500/10 text-green-600'
                      : isDown
                        ? 'bg-red-500/10 text-red-600'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <div className="flex items-center gap-1.5">
                    {isUp ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : isDown ? (
                      <AlertTriangle className="h-3 w-3 text-red-600" />
                    ) : (
                      <Clock className="text-muted-foreground h-3 w-3" />
                    )}
                    <span
                      className={`text-xs ${
                        isUp ? 'text-green-600' : isDown ? 'text-red-600' : 'text-muted-foreground'
                      }`}
                    >
                      {isUp ? 'Healthy' : isDown ? 'Down' : 'Unknown'}
                    </span>
                  </div>
                </div>
                {service?.lastError && (
                  <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                    Error
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── Key Metrics Grid ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MetricCard
          icon={Database}
          label="DB Connections"
          value={formatNumber(metrics.pg_connections, 0)}
          subtext={
            metrics.pg_max_connections
              ? `of ${formatNumber(metrics.pg_max_connections, 0)} max`
              : undefined
          }
          status={
            pgConnectionPct !== null
              ? pgConnectionPct > 80
                ? 'critical'
                : pgConnectionPct > 60
                  ? 'warning'
                  : 'good'
              : 'neutral'
          }
        />
        <MetricCard
          icon={HardDrive}
          label="DB Size"
          value={formatBytes(metrics.pg_database_size)}
          status={
            metrics.pg_database_size !== null
              ? metrics.pg_database_size > 10737418240
                ? 'critical'
                : metrics.pg_database_size > 5368709120
                  ? 'warning'
                  : 'good'
              : 'neutral'
          }
        />
        <MetricCard
          icon={MemoryStick}
          label="Redis Memory"
          value={formatBytes(metrics.redis_memory_used)}
          subtext={redisMemoryPct !== null ? `${redisMemoryPct.toFixed(1)}% used` : undefined}
          status={
            redisMemoryPct !== null
              ? redisMemoryPct > 90
                ? 'critical'
                : redisMemoryPct > 70
                  ? 'warning'
                  : 'good'
              : 'neutral'
          }
        />
        <MetricCard
          icon={Zap}
          label="Cache Hit Rate"
          value={formatPercent(metrics.redis_hit_rate)}
          status={
            metrics.redis_hit_rate !== null
              ? metrics.redis_hit_rate < 0.7
                ? 'critical'
                : metrics.redis_hit_rate < 0.85
                  ? 'warning'
                  : 'good'
              : 'neutral'
          }
        />
        <MetricCard
          icon={Gauge}
          label="Redis Ops/s"
          value={formatNumber(metrics.redis_commands_rate, 0)}
          status="neutral"
        />
        <MetricCard
          icon={ArrowUpDown}
          label="Redis Clients"
          value={formatNumber(metrics.redis_connected_clients, 0)}
          status={
            metrics.redis_connected_clients !== null
              ? metrics.redis_connected_clients > 100
                ? 'warning'
                : 'good'
              : 'neutral'
          }
        />
      </div>

      {/* ─── Tabs ───────────────────────────────────────── */}
      <Tabs defaultValue="infrastructure" className="space-y-4">
        <TabsList>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="business">Business Metrics</TabsTrigger>
          <TabsTrigger value="performance">API Performance</TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            Alerts
            {alertSummary.firing > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                {alertSummary.firing}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Infrastructure Tab ─────────────────────── */}
        <TabsContent value="infrastructure" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* PostgreSQL Connections */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-blue-500" />
                  Database Connections
                </CardTitle>
                <CardDescription>Active PostgreSQL connections</CardDescription>
              </CardHeader>
              <CardContent>
                {pgConnectionsData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart
                      data={pgConnectionsData}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip content={<MetricTooltip label="Connections" />} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--chart-1))"
                        fill="hsl(var(--chart-1))"
                        fillOpacity={0.15}
                        strokeWidth={2}
                        name="Connections"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Redis Memory */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MemoryStick className="h-4 w-4 text-red-500" />
                  Redis Memory Usage
                </CardTitle>
                <CardDescription>Memory usage in MB</CardDescription>
              </CardHeader>
              <CardContent>
                {redisMemoryData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart
                      data={redisMemoryData}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        tickFormatter={(v) => `${v.toFixed(0)} MB`}
                      />
                      <Tooltip content={<MetricTooltip label="Memory" unit=" MB" />} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--chart-2))"
                        fill="hsl(var(--chart-2))"
                        fillOpacity={0.15}
                        strokeWidth={2}
                        name="Memory (MB)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* PostgreSQL Transactions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-blue-500" />
                  Transaction Rate
                </CardTitle>
                <CardDescription>Commits per second</CardDescription>
              </CardHeader>
              <CardContent>
                {pgOpsData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={pgOpsData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip content={<MetricTooltip label="Commits/s" />} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--chart-3))"
                        strokeWidth={2}
                        dot={false}
                        name="Commits/s"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Redis Operations */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Redis Operations
                </CardTitle>
                <CardDescription>Commands processed per second</CardDescription>
              </CardHeader>
              <CardContent>
                {redisOpsData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={redisOpsData}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="time"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip content={<MetricTooltip label="Ops/s" />} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--chart-4))"
                        strokeWidth={2}
                        dot={false}
                        name="Ops/s"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Redis Uptime" value={formatUptime(metrics.redis_uptime)} />
            <MiniStat label="Total Redis Keys" value={formatNumber(metrics.redis_total_keys, 0)} />
            <MiniStat label="DB Commits/s" value={formatNumber(metrics.pg_commits_rate)} />
            <MiniStat
              label="Evicted Keys/s"
              value={formatNumber(metrics.redis_evicted_keys_rate)}
            />
          </div>
        </TabsContent>

        {/* ─── Business Metrics Tab ───────────────────── */}
        <TabsContent value="business" className="space-y-4">
          <BusinessMetrics />
        </TabsContent>

        {/* ─── API Performance Tab ─────────────────────── */}
        <TabsContent value="performance" className="space-y-4">
          <ApiPerformance />
        </TabsContent>

        {/* ─── Alerts Tab ─────────────────────────────── */}
        <TabsContent value="alerts" className="space-y-6">
          {/* System Alerts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">System Alerts</h3>
              <Badge variant="secondary" className="text-xs">
                {systemAlerts.length} active
              </Badge>
            </div>
            {systemAlerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <CheckCircle2 className="mb-2 h-8 w-8 text-green-500" />
                  <p className="text-sm font-medium">All Clear</p>
                  <p className="text-muted-foreground mt-1 text-xs">No active system alerts</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {systemAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} onUpdate={fetchData} />
                ))}
              </div>
            )}
          </div>

          {/* Infrastructure Alerts Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Infrastructure Alerts (Prometheus)</h3>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {alertSummary.total_rules} rules
                </Badge>
                {alertSummary.firing > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {alertSummary.firing} firing
                  </Badge>
                )}
              </div>
            </div>

            {/* Alert Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{alertSummary.total_rules}</p>
                  <p className="text-muted-foreground text-xs">Alert Rules</p>
                </CardContent>
              </Card>
              <Card className={alertSummary.firing > 0 ? 'border-red-500/50' : ''}>
                <CardContent className="p-4 text-center">
                  <p
                    className={`text-2xl font-bold ${alertSummary.firing > 0 ? 'text-red-600' : ''}`}
                  >
                    {alertSummary.firing}
                  </p>
                  <p className="text-muted-foreground text-xs">Firing</p>
                </CardContent>
              </Card>
              <Card className={alertSummary.pending > 0 ? 'border-yellow-500/50' : ''}>
                <CardContent className="p-4 text-center">
                  <p
                    className={`text-2xl font-bold ${alertSummary.pending > 0 ? 'text-yellow-600' : ''}`}
                  >
                    {alertSummary.pending}
                  </p>
                  <p className="text-muted-foreground text-xs">Pending</p>
                </CardContent>
              </Card>
            </div>

            {/* Prometheus Alerts List */}
            {prometheusAlerts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <CheckCircle2 className="mb-2 h-8 w-8 text-green-500" />
                  <p className="text-sm font-medium">All Clear</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    No active infrastructure alerts
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {prometheusAlerts.map((alert, i) => (
                  <Card
                    key={`${alert.name}-${i}`}
                    className={
                      alert.state === 'firing'
                        ? 'border-red-500/50 bg-red-500/5'
                        : alert.state === 'pending'
                          ? 'border-yellow-500/50 bg-yellow-500/5'
                          : ''
                    }
                  >
                    <CardContent className="flex items-start gap-3 p-4">
                      {alert.state === 'firing' ? (
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                      ) : (
                        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="text-sm font-medium">{alert.name}</p>
                          <Badge
                            variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {alert.severity}
                          </Badge>
                          <Badge
                            variant={alert.state === 'firing' ? 'destructive' : 'outline'}
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {alert.state}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {alert.summary || alert.description}
                        </p>
                        {alert.activeAt && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Since {new Date(alert.activeAt).toLocaleString('en-AU')}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  status,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  subtext?: string;
  status: 'good' | 'warning' | 'critical' | 'neutral';
}) {
  const statusColor = {
    good: 'text-green-600',
    warning: 'text-yellow-600',
    critical: 'text-red-600',
    neutral: 'text-foreground',
  }[status];

  const bgColor = {
    good: 'bg-green-500/10',
    warning: 'bg-yellow-500/10',
    critical: 'bg-red-500/10',
    neutral: 'bg-muted',
  }[status];

  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className={`rounded p-1 ${bgColor}`}>
            <Icon className={`h-3.5 w-3.5 ${statusColor}`} />
          </div>
          <span className="text-muted-foreground truncate text-xs">{label}</span>
        </div>
        <p className={`text-lg font-semibold ${statusColor}`}>{value}</p>
        {subtext && <p className="text-muted-foreground mt-0.5 text-[11px]">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-sm font-medium">{value}</p>
        <p className="text-muted-foreground text-[11px]">{label}</p>
      </CardContent>
    </Card>
  );
}

interface MetricTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload?: { time?: string } }>;
  label?: string;
  unit?: string;
}

function MetricTooltip({ active, payload, unit }: MetricTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background rounded-lg border p-2.5 shadow-md">
      <p className="text-muted-foreground mb-1 text-xs">{payload[0]?.payload?.time}</p>
      <p className="text-sm font-medium">
        {typeof payload[0]?.value === 'number' ? payload[0].value.toFixed(2) : payload[0]?.value}
        {unit || ''}
      </p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
      <div className="text-center">
        <Activity className="mx-auto mb-2 h-8 w-8 opacity-30" />
        <p>No data available</p>
        <p className="mt-1 text-xs">Waiting for metrics...</p>
      </div>
    </div>
  );
}
