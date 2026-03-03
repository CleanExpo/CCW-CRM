'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ClipboardCheck,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
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
import { useSearchState } from '@/lib/hooks/use-search-state';

interface ApprovalStep {
  id: string;
  step_number: number;
  approver_id: string;
  approver_role: string | null;
  status: string;
  comments: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface Approval {
  id: string;
  approval_type: string;
  entity_id: string;
  entity_type: string;
  status: string;
  total_steps: number;
  current_step: number;
  requested_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  steps: ApprovalStep[];
}

interface PaginatedApprovalResponse {
  data: Approval[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900',
    icon: XCircle,
  },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bg: 'bg-muted border', icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  order: 'Order',
  quote: 'Quote',
  purchase_order: 'Purchase Order',
  discount: 'Discount',
  credit_note: 'Credit Note',
};

export default function ApprovalsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<PaginatedApprovalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { state: searchState, updateField } = useSearchState({
    key: 'approvals-list',
    defaultState: { page: 1, statusFilter: 'all', typeFilter: 'all' },
  });

  const statusFilter = (searchState.statusFilter as string) ?? 'all';
  const typeFilter = (searchState.typeFilter as string) ?? 'all';
  const page = (searchState.page as number) ?? 1;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '50' });
      if (statusFilter !== 'all') params.set('status_filter', statusFilter);
      if (typeFilter !== 'all') params.set('approval_type', typeFilter);
      const res = await apiClient.get<PaginatedApprovalResponse>(`/api/approvals?${params}`);
      setData(res);
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load approvals',
      });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = data?.data.filter((a) => a.status === 'pending').length ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <ClipboardCheck className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Approval Workflows</h1>
            <p className="text-muted-foreground text-sm">
              Multi-step approval chains for orders, quotes, and purchase orders
              {pendingCount > 0 &&
                ` · ${pendingCount} pending action${pendingCount > 1 ? 's' : ''}`}
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
                <CardDescription>Total</CardDescription>
                <CardTitle className="text-3xl">{data?.total ?? 0}</CardTitle>
              </CardHeader>
            </Card>
            {(['pending', 'approved', 'rejected'] as const).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              const count = data?.data.filter((a) => a.status === s).length ?? 0;
              return (
                <Card key={s} className={`border ${cfg.bg}`}>
                  <CardHeader className="pb-2">
                    <CardDescription className={cfg.color}>{cfg.label}</CardDescription>
                    <CardTitle className={`text-3xl ${cfg.color}`}>{count}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {s === 'pending' ? 'Awaiting action' : `${cfg.label} workflows`}
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
        <Select value={statusFilter} onValueChange={(v) => updateField('statusFilter', v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => updateField('typeFilter', v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="order">Order</SelectItem>
            <SelectItem value="quote">Quote</SelectItem>
            <SelectItem value="purchase_order">Purchase Order</SelectItem>
            <SelectItem value="discount">Discount</SelectItem>
            <SelectItem value="credit_note">Credit Note</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">{data?.total ?? 0} workflows</span>
      </div>

      {/* Approval list */}
      <div className="flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : !data || data.data.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="text-muted-foreground/30 mx-auto mb-3 h-12 w-12" />
              <p className="text-muted-foreground">No approval workflows found</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Approval requests for orders, quotes and purchase orders will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          data.data.map((approval) => {
            const cfg = STATUS_CONFIG[approval.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isExpanded = expandedId === approval.id;
            return (
              <Card key={approval.id} className={`border ${cfg.bg}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`border ${cfg.bg} ${cfg.color}`}>
                        <Icon className="mr-1 h-3 w-3" />
                        {cfg.label}
                      </Badge>
                      <Badge variant="secondary">
                        {TYPE_LABELS[approval.approval_type] ?? approval.approval_type}
                      </Badge>
                      <span className="text-sm font-medium">
                        Step {approval.current_step} of {approval.total_steps}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {new Date(approval.created_at).toLocaleDateString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {approval.notes && (
                    <CardDescription className="mt-1">{approval.notes}</CardDescription>
                  )}
                </CardHeader>
                {isExpanded && approval.steps.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="mt-2 flex flex-col gap-2">
                      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Approval Steps
                      </p>
                      {approval.steps
                        .sort((a, b) => a.step_number - b.step_number)
                        .map((step) => {
                          const stepCfg = STATUS_CONFIG[step.status] ?? STATUS_CONFIG.pending;
                          const StepIcon = stepCfg.icon;
                          return (
                            <div
                              key={step.id}
                              className="bg-background/60 flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                            >
                              <StepIcon className={`h-4 w-4 ${stepCfg.color}`} />
                              <span className="font-medium">Step {step.step_number}</span>
                              {step.approver_role && (
                                <span className="text-muted-foreground">
                                  · {step.approver_role}
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={`ml-auto text-xs ${stepCfg.color}`}
                              >
                                {stepCfg.label}
                              </Badge>
                              {step.comments && (
                                <span
                                  className="text-muted-foreground max-w-48 truncate text-xs italic"
                                  title={step.comments}
                                >
                                  &quot;{step.comments}&quot;
                                </span>
                              )}
                              {step.reviewed_at && (
                                <span className="text-muted-foreground text-xs">
                                  {new Date(step.reviewed_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
