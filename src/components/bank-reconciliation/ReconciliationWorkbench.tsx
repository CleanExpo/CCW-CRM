'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  approveBankMatch,
  confidenceBandClass,
  confidenceBandLabel,
  createReconciliationRule,
  flagBankFeedForReview,
  getReconciliationWorkbench,
  importCdrCsv,
  splitBankMatch,
  type WorkbenchLine,
} from '@/lib/api/bank-reconciliation';
import { listBankAccounts, syncBankFeeds, type BankAccount } from '@/lib/api/bank-feeds';
import {
  CheckCircle2,
  Flag,
  GitBranch,
  RefreshCw,
  Split,
  Upload,
} from 'lucide-react';

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
}

export function ReconciliationWorkbench() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState<string>('all');
  const [lines, setLines] = useState<WorkbenchLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorkbenchLine | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [splitAmounts, setSplitAmounts] = useState({ a: '', b: '' });
  const [ruleForm, setRuleForm] = useState({ name: '', pattern: '', action: 'fee' });
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accts, wb] = await Promise.all([
        listBankAccounts(),
        getReconciliationWorkbench(accountId !== 'all' ? accountId : undefined),
      ]);
      setAccounts(accts);
      setLines(wb.lines);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load workbench',
      });
    } finally {
      setLoading(false);
    }
  }, [accountId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (line: WorkbenchLine, suggestionIndex = 0) => {
    const s = line.match_suggestions[suggestionIndex];
    if (!s) {
      toast({ variant: 'destructive', title: 'No suggestion to approve' });
      return;
    }
    try {
      await approveBankMatch({
        feed_id: line.feed_id,
        target_type: s.target_type,
        target_id: s.target_id,
      });
      toast({ title: 'Reconciled', description: s.label });
      load();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Match failed',
        description: e instanceof Error ? e.message : 'Could not reconcile',
      });
    }
  };

  const handleReview = async (line: WorkbenchLine) => {
    try {
      await flagBankFeedForReview(line.feed_id);
      toast({ title: 'Sent to review queue' });
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: String(e) });
    }
  };

  const handleSplit = async () => {
    if (!selected) return;
    const a = Number(splitAmounts.a);
    const b = Number(splitAmounts.b);
    if (!a || !b) return;
    try {
      await splitBankMatch({
        feed_id: selected.feed_id,
        allocations: [
          { allocation_type: 'expense', amount: a, notes: 'Split line 1' },
          { allocation_type: 'expense', amount: b, notes: 'Split line 2' },
        ],
      });
      toast({ title: 'Split reconciled' });
      setSplitOpen(false);
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Split failed', description: String(e) });
    }
  };

  const handleRule = async () => {
    if (!selected) return;
    try {
      await createReconciliationRule({
        name: ruleForm.name,
        match_pattern: ruleForm.pattern || selected.description.slice(0, 30),
        action_type: ruleForm.action,
      });
      toast({ title: 'Rule created' });
      setRuleOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Rule failed', description: String(e) });
    }
  };

  const handleSync = async () => {
    try {
      await syncBankFeeds({ account_id: accountId !== 'all' ? accountId : undefined });
      toast({ title: 'Bank feed synced' });
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Sync failed', description: String(e) });
    }
  };

  const handleImport = async (file: File) => {
    if (accountId === 'all') {
      toast({ variant: 'destructive', title: 'Select a bank account first' });
      return;
    }
    setImporting(true);
    try {
      const r = await importCdrCsv(accountId, file);
      toast({ title: 'CDR import complete', description: `${r.imported} transactions imported` });
      load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Import failed', description: String(e) });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Bank account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.account_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleSync}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync feeds
        </Button>
        <label className="inline-flex">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
          />
          <Button variant="outline" asChild disabled={importing}>
            <span>
              <Upload className="mr-2 h-4 w-4" />
              Import CDR CSV
            </span>
          </Button>
        </label>
        <Button variant="ghost" onClick={load}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : lines.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            No unreconciled bank lines. Sync feeds or import a CDR CSV to begin.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lines.map((line) => (
            <Card key={line.feed_id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{line.bank_account_name}</CardTitle>
                    <CardDescription>
                      {new Date(line.transaction_date).toLocaleDateString('en-AU')} ·{' '}
                      {line.reference || 'No reference'}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{formatMoney(line.amount)}</div>
                    {line.balance != null && (
                      <div className="text-muted-foreground text-xs">
                        Bal {formatMoney(line.balance)}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{line.description}</p>
                {line.raw_narration && line.raw_narration !== line.description && (
                  <p className="text-muted-foreground text-xs">{line.raw_narration}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Badge className={confidenceBandClass(line.confidence_score)}>
                    {confidenceBandLabel(line.confidence_score)}
                    {line.confidence_score != null ? ` (${Math.round(line.confidence_score)}%)` : ''}
                  </Badge>
                  {line.suggested_action && (
                    <Badge variant="outline">{line.suggested_action.replace(/_/g, ' ')}</Badge>
                  )}
                  {line.gst_category && <Badge variant="secondary">{line.gst_category}</Badge>}
                </div>

                {line.confidence_reason && (
                  <p className="text-muted-foreground text-xs">{line.confidence_reason}</p>
                )}

                {line.match_suggestions.length > 0 && (
                  <div className="bg-muted/40 space-y-2 rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide">Suggested match</p>
                    {line.match_suggestions.slice(0, 2).map((s, idx) => (
                      <div key={s.target_id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{s.label}</span>
                        <Badge variant="outline">{Math.round(s.confidence)}%</Badge>
                        {idx === 0 && (
                          <Button size="sm" onClick={() => handleApprove(line, 0)}>
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Approve
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelected(line);
                      setSplitAmounts({
                        a: String((line.amount / 2).toFixed(2)),
                        b: String((line.amount / 2).toFixed(2)),
                      });
                      setSplitOpen(true);
                    }}
                  >
                    <Split className="mr-1 h-3 w-3" />
                    Split
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleReview(line)}>
                    <Flag className="mr-1 h-3 w-3" />
                    Review
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelected(line);
                      setRuleForm({
                        name: `Rule: ${line.description.slice(0, 24)}`,
                        pattern: line.description.split(' ')[0] ?? '',
                        action: 'fee',
                      });
                      setRuleOpen(true);
                    }}
                  >
                    <GitBranch className="mr-1 h-3 w-3" />
                    Rule
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={splitOpen} onOpenChange={setSplitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Allocation 1 (AUD)</Label>
              <Input
                value={splitAmounts.a}
                onChange={(e) => setSplitAmounts((s) => ({ ...s, a: e.target.value }))}
              />
            </div>
            <div>
              <Label>Allocation 2 (AUD)</Label>
              <Input
                value={splitAmounts.b}
                onChange={(e) => setSplitAmounts((s) => ({ ...s, b: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSplit}>Apply split</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create bank rule</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Rule name</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Match pattern (in description)</Label>
              <Input
                value={ruleForm.pattern}
                onChange={(e) => setRuleForm((s) => ({ ...s, pattern: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRule}>Save rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
