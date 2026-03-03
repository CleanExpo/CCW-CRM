'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
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

interface HealthScore {
  customer_id: string;
  customer_number: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  is_active: boolean;
  order_count: number;
  quote_count: number;
  last_order_days: number | null;
  health_score: number;
  health_status: 'green' | 'amber' | 'red';
  score_breakdown: {
    recency: number;
    volume: number;
    engagement: number;
    account: number;
  };
}

interface HealthResponse {
  items: HealthScore[];
  total: number;
  summary: {
    total: number;
    green: number;
    amber: number;
    red: number;
    avg_score: number;
  };
  computed_at: string;
}

const STATUS_CONFIG = {
  green: {
    label: 'Healthy',
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900',
  },
  amber: {
    label: 'At Risk',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900',
  },
  red: {
    label: 'Churned',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900',
  },
} as const;

export default function CustomerHealthPage() {
  const { toast } = useToast();
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params =
        statusFilter !== 'all' ? `?status_filter=${statusFilter}&page_size=200` : '?page_size=200';
      const res = await apiClient.get<HealthResponse>(`/api/crm/health-scores${params}`);
      setData(res);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load health scores',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <Users className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Client Health Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              {data
                ? `Computed ${new Date(data.computed_at).toLocaleString()}`
                : 'Churn risk scoring per client'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
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
                <CardDescription>Total Clients</CardDescription>
                <CardTitle className="text-3xl">{summary?.total ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-xs">
                  Avg score: {summary?.avg_score ?? 0}/100
                </p>
              </CardContent>
            </Card>
            {(['green', 'amber', 'red'] as const).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              return (
                <Card key={s} className={`border ${cfg.bg}`}>
                  <CardHeader className="pb-2">
                    <CardDescription className={cfg.color}>{cfg.label}</CardDescription>
                    <CardTitle className={`text-3xl ${cfg.color}`}>{summary?.[s] ?? 0}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {summary && summary.total > 0
                        ? `${Math.round(((summary[s] ?? 0) / summary.total) * 100)}% of clients`
                        : '0%'}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            <SelectItem value="green">Healthy only</SelectItem>
            <SelectItem value="amber">At risk only</SelectItem>
            <SelectItem value="red">Churned only</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">{data?.total ?? 0} clients shown</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Score</th>
                  <th className="px-4 py-3 text-center font-medium">Orders</th>
                  <th className="px-4 py-3 text-center font-medium">Quotes</th>
                  <th className="px-4 py-3 text-center font-medium">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground px-4 py-12 text-center">
                      No clients found
                    </td>
                  </tr>
                ) : (
                  data?.items.map((row) => {
                    const cfg = STATUS_CONFIG[row.health_status];
                    const Icon = cfg.icon;
                    return (
                      <tr
                        key={row.customer_id}
                        className="hover:bg-muted/30 border-b transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{row.company_name}</p>
                            <p className="text-muted-foreground text-xs">{row.customer_number}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant="outline"
                            className={`mx-auto flex w-fit items-center gap-1 border ${cfg.bg} ${cfg.color}`}
                          >
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-lg font-bold ${cfg.color}`}>
                              {row.health_score}
                            </span>
                            <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                              <div
                                className={`h-full rounded-full ${
                                  row.health_status === 'green'
                                    ? 'bg-green-500'
                                    : row.health_status === 'amber'
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                }`}
                                style={{ width: `${row.health_score}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{row.order_count}</td>
                        <td className="px-4 py-3 text-center">{row.quote_count}</td>
                        <td className="text-muted-foreground px-4 py-3 text-center text-xs">
                          {row.last_order_days !== null
                            ? row.last_order_days === 0
                              ? 'Today'
                              : row.last_order_days === 1
                                ? 'Yesterday'
                                : `${row.last_order_days}d ago`
                            : 'Never'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
