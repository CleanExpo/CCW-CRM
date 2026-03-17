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
  Plus,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useSearchState } from '@/lib/hooks/use-search-state';
import { approvalsApi } from '@/lib/api/approvals';
import { slaApi } from '@/lib/api/sla';
import type { Approval, ApprovalStep, CreateApprovalRequest } from '@/lib/api/approvals';
import type { SLAInstance } from '@/lib/api/sla';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

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

// --- Review Step Dialog ---

interface ReviewDialogState {
  open: boolean;
  action: 'approve' | 'reject' | null;
  approvalId: string;
  stepId: string;
  stepLabel: string;
}

const REVIEW_DIALOG_CLOSED: ReviewDialogState = {
  open: false,
  action: null,
  approvalId: '',
  stepId: '',
  stepLabel: '',
};

function ReviewStepDialog({
  state,
  onClose,
  onSuccess,
}: {
  state: ReviewDialogState;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset comments whenever dialog opens
  useEffect(() => {
    if (state.open) setComments('');
  }, [state.open]);

  const handleSubmit = async () => {
    if (!state.action) return;
    setSubmitting(true);
    try {
      await approvalsApi.reviewStep(state.approvalId, state.stepId, {
        action: state.action,
        comments: comments.trim() || undefined,
      });
      toast({
        title: state.action === 'approve' ? 'Step Approved' : 'Step Rejected',
        description: `${state.stepLabel} has been ${state.action === 'approve' ? 'approved' : 'rejected'}.`,
      });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to review step',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isApprove = state.action === 'approve';

  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={isApprove ? 'text-green-600' : 'text-red-600'}>
            {isApprove ? 'Approve Step' : 'Reject Step'}
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? `Approve ${state.stepLabel}. The workflow will advance to the next step.`
              : `Reject ${state.stepLabel}. The entire workflow will be marked as rejected.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Label htmlFor="review-comments">Comments (optional)</Label>
          <Textarea
            id="review-comments"
            placeholder={isApprove ? 'Add approval notes...' : 'Reason for rejection...'}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? isApprove
                ? 'Approving...'
                : 'Rejecting...'
              : isApprove
                ? 'Approve'
                : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Create Approval Dialog ---

const EMPTY_CREATE: CreateApprovalRequest = {
  approval_type: 'order',
  entity_id: '',
  entity_type: 'order',
  total_steps: 1,
  requested_by: '',
  notes: '',
};

function CreateApprovalDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<CreateApprovalRequest>(EMPTY_CREATE);
  const [submitting, setSubmitting] = useState(false);

  // Reset form whenever dialog opens
  useEffect(() => {
    if (open) setForm(EMPTY_CREATE);
  }, [open]);

  // Keep entity_type in sync with approval_type
  const handleTypeChange = (value: string) => {
    setForm((prev) => ({ ...prev, approval_type: value, entity_type: value }));
  };

  const handleSubmit = async () => {
    if (!form.entity_id.trim()) {
      toast({ variant: 'destructive', title: 'Validation', description: 'Entity ID is required.' });
      return;
    }
    if (!form.requested_by.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation',
        description: 'Requested By (User ID) is required.',
      });
      return;
    }
    setSubmitting(true);
    try {
      await approvalsApi.create({
        ...form,
        entity_id: form.entity_id.trim(),
        entity_type: form.entity_type,
        requested_by: form.requested_by.trim(),
        notes: form.notes?.trim() || undefined,
      });
      toast({ title: 'Approval Created', description: 'New approval workflow has been created.' });
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create approval',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Approval Workflow</DialogTitle>
          <DialogDescription>
            Start a new multi-step approval workflow for an order, quote, or purchase order.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-type">Approval Type</Label>
            <Select value={form.approval_type} onValueChange={handleTypeChange}>
              <SelectTrigger id="create-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="purchase_order">Purchase Order</SelectItem>
                <SelectItem value="discount">Discount</SelectItem>
                <SelectItem value="credit_note">Credit Note</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-entity">Entity ID</Label>
            <Input
              id="create-entity"
              placeholder="UUID of the order / quote / PO"
              value={form.entity_id}
              onChange={(e) => setForm((prev) => ({ ...prev, entity_id: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-steps">Total Steps</Label>
            <Input
              id="create-steps"
              type="number"
              min={1}
              max={10}
              value={form.total_steps}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  total_steps: Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-requested-by">Requested By (User ID)</Label>
            <Input
              id="create-requested-by"
              placeholder="UUID of the requesting user"
              value={form.requested_by}
              onChange={(e) => setForm((prev) => ({ ...prev, requested_by: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-notes">Notes (optional)</Label>
            <Textarea
              id="create-notes"
              placeholder="Additional context or instructions..."
              value={form.notes ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Approval Step Row ---

function ApprovalStepRow({
  step,
  approval,
  onReview,
}: {
  step: ApprovalStep;
  approval: Approval;
  onReview: (action: 'approve' | 'reject', stepId: string, stepLabel: string) => void;
}) {
  const stepCfg = STATUS_CONFIG[step.status] ?? STATUS_CONFIG.pending;
  const StepIcon = stepCfg.icon;

  const isActionable =
    step.status === 'pending' &&
    step.step_number === approval.current_step &&
    approval.status === 'pending';

  return (
    <ErrorBoundary>
      <div className="bg-background/60 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm">
        <StepIcon className={`h-4 w-4 shrink-0 ${stepCfg.color}`} />
        <span className="font-medium">Step {step.step_number}</span>
        {step.approver_role && (
          <span className="text-muted-foreground">· {step.approver_role}</span>
        )}
        <Badge variant="outline" className={`text-xs ${stepCfg.color}`}>
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
        {isActionable && (
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
              onClick={() => onReview('approve', step.id, `Step ${step.step_number}`)}
            >
              <ThumbsUp className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              onClick={() => onReview('reject', step.id, `Step ${step.step_number}`)}
            >
              <ThumbsDown className="mr-1 h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

// --- Main Page ---

// ---------------------------------------------------------------------------
// SLA helpers (approvals page)
// ---------------------------------------------------------------------------

function ApprovalSlaDeadline({ instance }: { instance: SLAInstance | undefined }) {
  if (!instance) {
    return <span className="text-muted-foreground text-xs">No SLA</span>;
  }

  const deadline = new Date(instance.deadline);
  const minutesLeft = Math.floor((deadline.getTime() - Date.now()) / 60000);
  const formatted = deadline.toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const colorClass = instance.breached
    ? 'text-red-600 dark:text-red-400'
    : minutesLeft <= 120
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-green-600 dark:text-green-400';

  return (
    <span className={`text-xs font-medium ${colorClass}`}>
      {formatted}
      {instance.breached && ' · Breached'}
    </span>
  );
}

// --- Main Page ---

export default function ApprovalsPage() {
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>(REVIEW_DIALOG_CLOSED);

  // SLA state — best-effort, never blocks the page
  const [slaMap, setSlaMap] = useState<Map<string, SLAInstance>>(new Map());

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
      const res = await approvalsApi.list({
        page,
        page_size: 50,
        status_filter: statusFilter !== 'all' ? statusFilter : undefined,
        approval_type: typeFilter !== 'all' ? typeFilter : undefined,
      });
      setApprovals(res.data);
      setTotal(res.total);
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

  // Load SLA instances — best-effort, silently swallowed on error
  const loadSlaInstances = useCallback(async () => {
    try {
      const instances = await slaApi.getInstances({ entity_type: 'approval' });
      const map = new Map<string, SLAInstance>();
      for (const inst of instances) {
        map.set(inst.entity_id, inst);
      }
      setSlaMap(map);
    } catch {
      // SLA endpoint may not be available yet — never break the page
    }
  }, []);

  useEffect(() => {
    load();
    loadSlaInstances();
  }, [load, loadSlaInstances]);

  const openReviewDialog = (
    action: 'approve' | 'reject',
    approvalId: string,
    stepId: string,
    stepLabel: string
  ) => {
    setReviewDialog({ open: true, action, approvalId, stepId, stepLabel });
  };

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

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
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Multi-step approval chains for orders, quotes, and purchase orders
              {pendingCount > 0 &&
                ` · ${pendingCount} pending action${pendingCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Approval
          </Button>
        </div>
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
                <CardTitle className="text-3xl">{total}</CardTitle>
              </CardHeader>
            </Card>
            {(['pending', 'approved', 'rejected'] as const).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const Icon = cfg.icon;
              const count = approvals.filter((a) => a.status === s).length;
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
        <span className="text-muted-foreground text-sm">{total} workflows</span>
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
        ) : approvals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="text-muted-foreground/30 mx-auto mb-3 h-12 w-12" />
              <p className="text-muted-foreground">No approval workflows found</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Approval requests for orders, quotes and purchase orders will appear here.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Approval
              </Button>
            </CardContent>
          </Card>
        ) : (
          approvals.map((approval) => {
            const cfg = STATUS_CONFIG[approval.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const isExpanded = expandedId === approval.id;
            const hasPendingStep =
              approval.status === 'pending' &&
              approval.steps.some(
                (s) => s.status === 'pending' && s.step_number === approval.current_step
              );
            return (
              <Card key={approval.id} className={`border ${cfg.bg}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-3">
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
                      {hasPendingStep && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                          Action Required
                        </Badge>
                      )}
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
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">SLA Deadline:</span>
                    <ApprovalSlaDeadline instance={slaMap.get(approval.entity_id)} />
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="mt-2 flex flex-col gap-2">
                      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        Approval Steps
                      </p>
                      {approval.steps.length === 0 ? (
                        <p className="text-muted-foreground text-sm italic">
                          No steps defined for this workflow.
                        </p>
                      ) : (
                        approval.steps
                          .slice()
                          .sort((a, b) => a.step_number - b.step_number)
                          .map((step) => (
                            <ApprovalStepRow
                              key={step.id}
                              step={step}
                              approval={approval}
                              onReview={(action, stepId, stepLabel) =>
                                openReviewDialog(action, approval.id, stepId, stepLabel)
                              }
                            />
                          ))
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Dialogs */}
      <ReviewStepDialog
        state={reviewDialog}
        onClose={() => setReviewDialog(REVIEW_DIALOG_CLOSED)}
        onSuccess={load}
      />
      <CreateApprovalDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={load}
      />
    </div>
  );
}
