'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, RefreshCw, Shield, XCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

interface Alert {
  id: number;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
  acknowledged: boolean;
  resolved: boolean;
}

interface AlertListResponse {
  alerts: Alert[];
  total: number;
}

const SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  critical: {
    label: 'Critical',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900',
    icon: XCircle,
  },
  error: {
    label: 'Error',
    color: 'text-red-500',
    bg: 'bg-red-50 border-red-100 dark:bg-red-950 dark:border-red-800',
    icon: XCircle,
  },
  warning: {
    label: 'Warning',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900',
    icon: AlertTriangle,
  },
  info: {
    label: 'Info',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900',
    icon: Info,
  },
};

export default function AlertsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AlertListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (!showAcknowledged) params.set('acknowledged', 'false');
      const res = await apiClient.get<AlertListResponse>(`/api/monitoring/alerts?${params}`);
      setData(res);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load alerts',
      });
      setData({ alerts: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [severityFilter, showAcknowledged, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAcknowledge = async (alertId: number) => {
    setActioning(alertId);
    try {
      await apiClient.post(`/api/monitoring/alerts/${alertId}/acknowledge`, {});
      toast({ title: 'Alert acknowledged' });
      load();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to acknowledge alert',
      });
    } finally {
      setActioning(null);
    }
  };

  const handleResolve = async (alertId: number) => {
    setActioning(alertId);
    try {
      await apiClient.post(`/api/monitoring/alerts/${alertId}/resolve`, {});
      toast({ title: 'Alert resolved' });
      load();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resolve alert',
      });
    } finally {
      setActioning(null);
    }
  };

  const criticalCount =
    data?.alerts.filter((a) => a.severity === 'critical' && !a.resolved).length ?? 0;
  const activeCount = data?.alerts.filter((a) => !a.resolved).length ?? 0;

  return (
    <ErrorBoundary>
      <div className="flex flex-1 flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${criticalCount > 0 ? 'bg-red-100' : 'bg-primary/10'}`}
            >
              <Bell className={`h-5 w-5 ${criticalCount > 0 ? 'text-red-600' : 'text-primary'}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Alerts</h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {activeCount > 0
                  ? `${activeCount} active alert${activeCount > 1 ? 's' : ''}${criticalCount > 0 ? ` · ${criticalCount} critical` : ''}`
                  : 'No active alerts'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Alerts</CardDescription>
                  <CardTitle className="text-3xl">{data?.total ?? 0}</CardTitle>
                </CardHeader>
              </Card>
              {(['critical', 'warning', 'info'] as const).map((s) => {
                const cfg = SEVERITY_CONFIG[s];
                const Icon = cfg.icon;
                const count = data?.alerts.filter((a) => a.severity === s).length ?? 0;
                return (
                  <Card key={s} className={`border ${count > 0 ? cfg.bg : ''}`}>
                    <CardHeader className="pb-2">
                      <CardDescription className={count > 0 ? cfg.color : ''}>
                        {cfg.label}
                      </CardDescription>
                      <CardTitle className={`text-3xl ${count > 0 ? cfg.color : ''}`}>
                        {count}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`flex items-center gap-1 text-xs ${count > 0 ? cfg.color : 'text-muted-foreground'}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {count > 0 ? 'Needs attention' : 'All clear'}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showAcknowledged ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAcknowledged(!showAcknowledged)}
          >
            <Shield className="mr-2 h-4 w-4" />
            {showAcknowledged ? 'Hiding resolved' : 'Show all'}
          </Button>
          <span className="text-muted-foreground text-sm">{data?.total ?? 0} alerts</span>
        </div>

        {/* Alert list */}
        <div className="flex flex-col gap-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : !data || data.alerts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500/50" />
                <p className="text-muted-foreground font-medium">No active alerts</p>
                <p className="text-muted-foreground mt-1 text-sm">System is operating normally.</p>
              </CardContent>
            </Card>
          ) : (
            data.alerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info;
              const Icon = cfg.icon;
              const isActioning = actioning === alert.id;
              return (
                <Card
                  key={alert.id}
                  className={`border ${alert.resolved ? 'opacity-60' : ''} ${!alert.resolved ? cfg.bg : 'border-muted'}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Icon
                          className={`mt-0.5 h-5 w-5 flex-shrink-0 ${alert.resolved ? 'text-muted-foreground' : cfg.color}`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{alert.title}</span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${!alert.resolved ? `${cfg.bg} ${cfg.color}` : ''}`}
                            >
                              {cfg.label}
                            </Badge>
                            {alert.acknowledged && !alert.resolved && (
                              <Badge variant="outline" className="text-muted-foreground text-xs">
                                Acknowledged
                              </Badge>
                            )}
                            {alert.resolved && (
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-xs text-green-600"
                              >
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-0.5">{alert.message}</CardDescription>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {alert.type} · {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {!alert.resolved && (
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {!alert.acknowledged && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcknowledge(alert.id)}
                              disabled={isActioning}
                              className="text-xs"
                            >
                              {isActioning ? '...' : 'Acknowledge'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolve(alert.id)}
                            disabled={isActioning}
                            className="border-green-200 text-xs text-green-600 hover:text-green-700"
                          >
                            {isActioning ? '...' : 'Resolve'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
