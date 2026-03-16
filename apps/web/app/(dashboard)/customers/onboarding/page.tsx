'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  GitBranch,
  Mail,
  RefreshCw,
  SkipForward,
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

interface Touchpoint {
  id: string;
  day: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  email_subject: string | null;
}

interface Sequence {
  id: string;
  customer_id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  status: string;
  triggered_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  touchpoints: Touchpoint[];
}

interface SequencesResponse {
  items: Sequence[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const SEQ_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active: {
    label: 'Active',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900',
  },
  completed: {
    label: 'Completed',
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900',
  },
};

const TP_STATUS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  scheduled: { icon: Clock, color: 'text-blue-500', label: 'Scheduled' },
  sent: { icon: CheckCircle2, color: 'text-green-500', label: 'Sent' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  skipped: { icon: SkipForward, color: 'text-muted-foreground', label: 'Skipped' },
};

export default function OnboardingPage() {
  const { toast } = useToast();
  const [data, setData] = useState<SequencesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== 'all' ? `?status_filter=${statusFilter}` : '';
      const res = await apiClient.get<SequencesResponse>(`/api/crm/onboarding/sequences${params}`);
      setData(res);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load sequences',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async (seqId: string, companyName: string) => {
    setCancelling(seqId);
    try {
      await apiClient.patch(`/api/crm/onboarding/sequences/${seqId}/cancel`, {});
      toast({
        title: 'Cancelled',
        description: `Onboarding sequence for ${companyName} cancelled.`,
      });
      load();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to cancel sequence',
      });
    } finally {
      setCancelling(null);
    }
  };

  const activeCount = data?.items.filter((s) => s.status === 'active').length ?? 0;
  const completedCount = data?.items.filter((s) => s.status === 'completed').length ?? 0;
  const cancelledCount = data?.items.filter((s) => s.status === 'cancelled').length ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <GitBranch className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Onboarding Sequences</h1>
            <p className="text-muted-foreground text-sm">
              Day-1, Day-7, Day-30 automated email touchpoints
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
              <CardHeader className="pb-2">
                <CardDescription className="text-blue-600">Active</CardDescription>
                <CardTitle className="text-3xl text-blue-600">{activeCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-blue-500">In progress</p>
              </CardContent>
            </Card>
            <Card className="border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
              <CardHeader className="pb-2">
                <CardDescription className="text-green-600">Completed</CardDescription>
                <CardTitle className="text-3xl text-green-600">{completedCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-green-500">All touchpoints sent</p>
              </CardContent>
            </Card>
            <Card className="border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
              <CardHeader className="pb-2">
                <CardDescription className="text-red-600">Cancelled</CardDescription>
                <CardTitle className="text-3xl text-red-600">{cancelledCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-red-500">Manually stopped</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sequences</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="completed">Completed only</SelectItem>
            <SelectItem value="cancelled">Cancelled only</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">{data?.total ?? 0} sequences</span>
      </div>

      {/* Sequences */}
      <div className="flex flex-col gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))
        ) : data?.items.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center">
              No onboarding sequences found
            </CardContent>
          </Card>
        ) : (
          data?.items.map((seq) => {
            const cfg = SEQ_STATUS[seq.status] ?? SEQ_STATUS.active;
            return (
              <Card key={seq.id} className={`border ${cfg.bg}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{seq.company_name}</CardTitle>
                      <CardDescription>
                        {seq.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {seq.email}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`border ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                      {seq.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(seq.id, seq.company_name)}
                          disabled={cancelling === seq.id}
                          className="border-red-200 text-red-600 hover:text-red-700"
                        >
                          {cancelling === seq.id ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Triggered:{' '}
                    {seq.triggered_at ? new Date(seq.triggered_at).toLocaleDateString() : '—'}
                    {seq.completed_at &&
                      ` · Completed: ${new Date(seq.completed_at).toLocaleDateString()}`}
                    {seq.cancelled_at &&
                      ` · Cancelled: ${new Date(seq.cancelled_at).toLocaleDateString()}`}
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-3">
                    {seq.touchpoints
                      .sort((a, b) => parseInt(a.day) - parseInt(b.day))
                      .map((tp) => {
                        const tpCfg = TP_STATUS[tp.status] ?? TP_STATUS.scheduled;
                        const Icon = tpCfg.icon;
                        return (
                          <div
                            key={tp.id}
                            className="bg-background/60 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
                          >
                            <Icon className={`h-3.5 w-3.5 ${tpCfg.color}`} />
                            <span className="font-medium">Day {tp.day}</span>
                            <span className={`${tpCfg.color}`}>· {tpCfg.label}</span>
                            {tp.sent_at && (
                              <span className="text-muted-foreground">
                                {new Date(tp.sent_at).toLocaleDateString()}
                              </span>
                            )}
                            {tp.status === 'scheduled' && tp.scheduled_at && (
                              <span className="text-muted-foreground">
                                due {new Date(tp.scheduled_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
