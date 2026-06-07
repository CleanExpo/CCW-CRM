'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Play, Pause, Trash2, GitMerge, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { workflowsApi, type WorkflowTemplate, type WorkflowInstance } from '@/lib/api/workflows';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { OperationsPageHeader } from '@/components/operations/OperationsPageHeader';
import { opCardClass, opInsetClass } from '@/lib/operations/ui';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIGGER_EVENTS = [
  { value: 'order_created', label: 'Order Created' },
  { value: 'invoice_sent', label: 'Invoice Sent' },
  { value: 'order_status_changed', label: 'Order Status Changed' },
  { value: 'quote_accepted', label: 'Quote Accepted' },
  { value: 'quote_expired', label: 'Quote Expired' },
  { value: 'invoice_overdue', label: 'Invoice Overdue' },
  { value: 'sla_breached', label: 'SLA Breached' },
  { value: 'customer_created', label: 'Customer Created' },
  { value: 'task_completed', label: 'Task Completed' },
  { value: 'approval_required', label: 'Approval Required' },
  { value: 'low_stock', label: 'Low Stock Alert' },
];

/** Status chips — explicit light + dark tones for readability on elevated surfaces */
const INSTANCE_STATUS_CLASS: Record<string, string> = {
  running:
    'border-sky-500/35 bg-sky-500/15 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/12 dark:text-sky-100',
  completed:
    'border-emerald-500/35 bg-emerald-500/15 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-100',
  failed:
    'border-destructive/40 bg-destructive/15 text-destructive dark:bg-destructive/12',
};

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const templateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  trigger_event: z.string().min(1, 'Trigger event is required'),
  is_active: z.boolean().default(true),
});

type TemplateFormData = z.infer<typeof templateSchema>;

// ---------------------------------------------------------------------------
// Template Card
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: WorkflowTemplate;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (t: WorkflowTemplate) => void;
  onDelete: (id: string) => void;
}

function TemplateCard({ template, onToggle, onEdit, onDelete }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);

  const triggerLabel =
    TRIGGER_EVENTS.find((e) => e.value === template.trigger_event)?.label ?? template.trigger_event;

  return (
    <Card className={cn('transition-shadow hover:shadow-md', opCardClass)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitMerge className="text-primary h-4 w-4 shrink-0" />
              <span className="truncate">{template.name}</span>
            </CardTitle>
            {template.description && (
              <p className="text-muted-foreground mt-1 text-sm">{template.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={template.is_active ? 'default' : 'secondary'} className="text-xs">
              {template.is_active ? 'Active' : 'Paused'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Trigger */}
        <div className="border-border bg-muted/35 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <Zap className="text-primary h-3.5 w-3.5 shrink-0" />
          <span className="text-muted-foreground">Trigger:</span>
          <span className="font-medium">{triggerLabel}</span>
        </div>

        {/* Actions count */}
        {template.actions.length > 0 && (
          <button
            className="text-muted-foreground flex w-full items-center gap-1 text-xs underline-offset-2 hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {template.actions.length} action{template.actions.length !== 1 ? 's' : ''}
          </button>
        )}

        {expanded && (
          <ol className="list-inside list-decimal space-y-1 pl-1">
            {template.actions.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-medium">{a.action_type}</span>
                {a.action_config && (
                  <span className="text-muted-foreground ml-1 text-xs">
                    {JSON.stringify(a.action_config).slice(0, 60)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}

        {/* Actions row */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => onEdit(template)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => onToggle(template.id, !template.is_active)}
          >
            {template.is_active ? (
              <>
                <Pause className="mr-1 h-3 w-3" />
                Pause
              </>
            ) : (
              <>
                <Play className="mr-1 h-3 w-3" />
                Activate
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 ml-auto h-7 px-2 text-xs"
            onClick={() => onDelete(template.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Template form dialog
// ---------------------------------------------------------------------------

interface TemplateDialogProps {
  open: boolean;
  initial?: WorkflowTemplate;
  onClose: () => void;
  onSaved: (t: WorkflowTemplate) => void;
}

function TemplateDialog({ open, initial, onClose, onSaved }: TemplateDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      trigger_event: initial?.trigger_event ?? '',
      is_active: initial?.is_active ?? true,
    },
  });

  useEffect(() => {
    form.reset({
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      trigger_event: initial?.trigger_event ?? '',
      is_active: initial?.is_active ?? true,
    });
  }, [initial, form]);

  async function onSubmit(values: TemplateFormData) {
    setSaving(true);
    try {
      const saved = initial
        ? await workflowsApi.updateTemplate(initial.id, values)
        : await workflowsApi.createTemplate(values);
      onSaved(saved);
      toast({
        title: initial ? 'Workflow updated' : 'Workflow created',
        description: `"${saved.name}" saved successfully.`,
      });
      onClose();
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Notify on SLA breach" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What does this workflow do?"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trigger_event"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trigger Event *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger…" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TRIGGER_EVENTS.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WorkflowsPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkflowTemplate | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tmpl, inst] = await Promise.all([
        workflowsApi.listTemplates(),
        workflowsApi.listInstances(),
      ]);
      setTemplates(tmpl);
      setInstances(inst.slice(0, 20)); // latest 20
    } catch {
      toast({ title: 'Failed to load workflows', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function handleEdit(t: WorkflowTemplate) {
    setEditTarget(t);
    setDialogOpen(true);
  }

  function handleNew() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function handleSaved(saved: WorkflowTemplate) {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      const updated = await workflowsApi.updateTemplate(id, { is_active: active });
      setTemplates((prev) => prev.map((t) => (t.id === id ? updated : t)));
      toast({
        title: active ? 'Workflow activated' : 'Workflow paused',
        description: updated.name,
      });
    } catch {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  }

  async function handleDelete(id: string) {
    try {
      await workflowsApi.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast({ title: 'Workflow deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  }

  const active = templates.filter((t) => t.is_active).length;
  const runningInstances = instances.filter((i) => i.status === 'running').length;

  return (
    <ErrorBoundary>
      <div className="space-y-8">
        <OperationsPageHeader
          title="Workflow automation"
          description="Trigger-based templates and recent runs for equipment ordering, approvals, and fulfilment."
          icon={GitMerge}
          sectionLabel="Admin"
          accent="aurora"
          actions={
            <Button onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              New workflow
            </Button>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Total', value: templates.length },
            { label: 'Active', value: active },
            { label: 'Paused', value: templates.length - active },
            { label: 'Running now', value: runningInstances },
          ].map((s) => (
            <Card key={s.label} className={opCardClass}>
              <CardContent className="pt-4">
                <p className="text-muted-foreground text-xs">{s.label}</p>
                <p className="text-card-foreground text-2xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Templates grid */}
        <div>
          <h2 className="text-foreground mb-3 text-base font-semibold">Templates</h2>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border-border bg-muted/50 h-40 animate-pulse rounded-xl border"
                />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card className={opCardClass}>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <GitMerge className="text-muted-foreground mb-3 h-10 w-10" />
                <p className="font-medium">No workflows yet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Create your first workflow to automate equipment ordering and fulfilment.
                </p>
                <Button className="mt-4" onClick={handleNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Workflow
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={(id) => setDeleteId(id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent instances */}
        {instances.length > 0 && (
          <div>
            <h2 className="text-foreground mb-3 text-base font-semibold">Recent executions</h2>
            <div className="space-y-2">
              {instances.map((inst) => (
                <div
                  key={inst.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap',
                    opInsetClass
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-medium">
                      {inst.trigger_entity_type} · {inst.trigger_entity_id?.slice(0, 8) ?? '—'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Started {new Date(inst.started_at).toLocaleString()}
                    </p>
                    {inst.error_message && (
                      <p className="text-destructive mt-0.5 text-xs">{inst.error_message}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                      INSTANCE_STATUS_CLASS[inst.status] ??
                        'border-border bg-muted/70 text-muted-foreground'
                    )}
                  >
                    {inst.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create / Edit dialog */}
        <TemplateDialog
          open={dialogOpen}
          initial={editTarget}
          onClose={() => setDialogOpen(false)}
          onSaved={handleSaved}
        />

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete workflow?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the workflow template. Existing instances will remain.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteId && handleDelete(deleteId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ErrorBoundary>
  );
}
