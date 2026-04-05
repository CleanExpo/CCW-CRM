'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, ChevronLeft, FilePlus, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  listAccounts,
  syncChartOfAccounts,
  listJournalEntries,
  createJournalEntry,
  postJournalEntry,
  listAccountMappings,
  upsertAccountMapping,
  type Cin7ChartOfAccount,
  type Cin7JournalEntry,
  type Cin7AccountMapping,
  type JournalLineCreateRequest,
  type AccountType,
  type ErpEntityType,
} from '@/lib/api/cin7-gl';

// ---------------------------------------------------------------------------
// Helpers / badge colours
// ---------------------------------------------------------------------------

function accountTypeBadge(type: string) {
  const map: Record<string, string> = {
    asset: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    liability: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    equity: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    revenue: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    expense: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    cost_of_goods: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };
  return map[type] ?? 'bg-muted text-muted-foreground';
}

function journalStatusBadge(status: string): React.ReactNode {
  if (status === 'posted') {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Posted
      </Badge>
    );
  }
  if (status === 'void') {
    return <Badge variant="secondary">Void</Badge>;
  }
  return <Badge variant="outline">Draft</Badge>;
}

function sourceBadge(source: string): React.ReactNode {
  const labels: Record<string, string> = {
    manual: 'Manual',
    order: 'Order',
    invoice: 'Invoice',
    payment: 'Payment',
    adjustment: 'Adjustment',
  };
  return (
    <Badge variant="secondary" className="capitalize">
      {labels[source] ?? source}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Demo fallback data (shown if API is unreachable)
// ---------------------------------------------------------------------------

const DEMO_ACCOUNTS: Cin7ChartOfAccount[] = [
  {
    id: 'a1',
    cin7_account_id: 'CIN7-1000',
    account_code: '1000',
    account_name: 'Cash and Bank',
    account_type: 'asset',
    parent_account_id: null,
    is_active: true,
    currency: 'AUD',
    description: 'Current cash and bank accounts',
    last_synced_at: '2026-03-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'a2',
    cin7_account_id: 'CIN7-1200',
    account_code: '1200',
    account_name: 'Accounts Receivable',
    account_type: 'asset',
    parent_account_id: null,
    is_active: true,
    currency: 'AUD',
    description: 'Amounts owed by customers',
    last_synced_at: '2026-03-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'a3',
    cin7_account_id: 'CIN7-2000',
    account_code: '2000',
    account_name: 'Accounts Payable',
    account_type: 'liability',
    parent_account_id: null,
    is_active: true,
    currency: 'AUD',
    description: 'Amounts owed to suppliers',
    last_synced_at: '2026-03-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'a4',
    cin7_account_id: 'CIN7-2200',
    account_code: '2200',
    account_name: 'GST Payable',
    account_type: 'liability',
    parent_account_id: null,
    is_active: true,
    currency: 'AUD',
    description: 'GST collected on sales',
    last_synced_at: '2026-03-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'a5',
    cin7_account_id: 'CIN7-3000',
    account_code: '3000',
    account_name: 'Retained Earnings',
    account_type: 'equity',
    parent_account_id: null,
    is_active: true,
    currency: 'AUD',
    description: 'Accumulated retained earnings',
    last_synced_at: '2026-03-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'a6',
    cin7_account_id: 'CIN7-4000',
    account_code: '4000',
    account_name: 'Sales Revenue',
    account_type: 'revenue',
    parent_account_id: null,
    is_active: true,
    currency: 'AUD',
    description: 'Revenue from equipment sales',
    last_synced_at: '2026-03-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'a7',
    cin7_account_id: 'CIN7-5000',
    account_code: '5000',
    account_name: 'Cost of Goods Sold',
    account_type: 'cost_of_goods',
    parent_account_id: null,
    is_active: true,
    currency: 'AUD',
    description: 'Direct cost of products sold',
    last_synced_at: '2026-03-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
  {
    id: 'a8',
    cin7_account_id: 'CIN7-6000',
    account_code: '6000',
    account_name: 'Operating Expenses',
    account_type: 'expense',
    parent_account_id: null,
    is_active: true,
    currency: 'AUD',
    description: 'General operating expenditure',
    last_synced_at: '2026-03-01T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  },
];

const DEMO_JOURNALS: Cin7JournalEntry[] = [
  {
    id: 'j1',
    cin7_journal_id: 'CIN7-JNL-0001',
    journal_date: '2026-03-01',
    reference: 'ORD-2026-001',
    description: 'Sales order revenue recognition',
    status: 'posted',
    total_debit: '5500.00',
    total_credit: '5500.00',
    currency: 'AUD',
    source: 'order',
    cin7_synced: true,
    created_at: '2026-03-01T09:00:00Z',
    updated_at: '2026-03-01T09:05:00Z',
    lines: [],
  },
  {
    id: 'j2',
    cin7_journal_id: null,
    journal_date: '2026-03-02',
    reference: 'MAN-2026-001',
    description: 'Manual adjustment — stock write-down',
    status: 'draft',
    total_debit: '800.00',
    total_credit: '800.00',
    currency: 'AUD',
    source: 'manual',
    cin7_synced: false,
    created_at: '2026-03-02T14:00:00Z',
    updated_at: '2026-03-02T14:00:00Z',
    lines: [],
  },
];

const DEMO_MAPPINGS: Cin7AccountMapping[] = [
  {
    id: 'm1',
    erp_entity_type: 'order',
    erp_field: 'revenue',
    cin7_account_id: 'a6',
    account_code: '4000',
    account_name: 'Sales Revenue',
    is_default: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'm2',
    erp_entity_type: 'order',
    erp_field: 'receivable',
    cin7_account_id: 'a2',
    account_code: '1200',
    account_name: 'Accounts Receivable',
    is_default: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'm3',
    erp_entity_type: 'order',
    erp_field: 'tax',
    cin7_account_id: 'a4',
    account_code: '2200',
    account_name: 'GST Payable',
    is_default: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'm4',
    erp_entity_type: 'payment',
    erp_field: 'bank',
    cin7_account_id: 'a1',
    account_code: '1000',
    account_name: 'Cash and Bank',
    is_default: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'm5',
    erp_entity_type: 'invoice',
    erp_field: 'payable',
    cin7_account_id: 'a3',
    account_code: '2000',
    account_name: 'Accounts Payable',
    is_default: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// New journal dialog helpers
// ---------------------------------------------------------------------------

interface DraftLine {
  key: number;
  account_id: string;
  line_type: 'debit' | 'credit';
  amount: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function GlIntegrationPage() {
  const { toast } = useToast();

  // Chart of Accounts state
  const [accounts, setAccounts] = useState<Cin7ChartOfAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Journal Entries state
  const [journals, setJournals] = useState<Cin7JournalEntry[]>([]);
  const [journalsLoading, setJournalsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [postingId, setPostingId] = useState<string | null>(null);

  // New journal dialog state
  const [newJournalOpen, setNewJournalOpen] = useState(false);
  const [journalDate, setJournalDate] = useState('');
  const [journalReference, setJournalReference] = useState('');
  const [journalDescription, setJournalDescription] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([
    { key: 0, account_id: '', line_type: 'debit', amount: '', description: '' },
    { key: 1, account_id: '', line_type: 'credit', amount: '', description: '' },
  ]);
  const [creatingJournal, setCreatingJournal] = useState(false);

  // Account Mappings state
  const [mappings, setMappings] = useState<Cin7AccountMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [editMapping, setEditMapping] = useState<Cin7AccountMapping | null>(null);
  const [editAccountCode, setEditAccountCode] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await listAccounts();
      setAccounts(res.accounts.length ? res.accounts : DEMO_ACCOUNTS);
    } catch {
      setAccounts(DEMO_ACCOUNTS);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadJournals = useCallback(async () => {
    setJournalsLoading(true);
    try {
      const res = await listJournalEntries(
        1,
        50,
        statusFilter === 'all' ? undefined : (statusFilter as 'draft' | 'posted' | 'void')
      );
      setJournals(res.entries.length ? res.entries : DEMO_JOURNALS);
    } catch {
      setJournals(DEMO_JOURNALS);
    } finally {
      setJournalsLoading(false);
    }
  }, [statusFilter]);

  const loadMappings = useCallback(async () => {
    setMappingsLoading(true);
    try {
      const res = await listAccountMappings();
      setMappings(res.mappings.length ? res.mappings : DEMO_MAPPINGS);
    } catch {
      setMappings(DEMO_MAPPINGS);
    } finally {
      setMappingsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
    void loadJournals();
    void loadMappings();
  }, [loadAccounts, loadJournals, loadMappings]);

  useEffect(() => {
    void loadJournals();
  }, [loadJournals]);

  // ---------------------------------------------------------------------------
  // Chart of Accounts actions
  // ---------------------------------------------------------------------------

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncChartOfAccounts();
      toast({
        title: 'Chart of Accounts Synced',
        description: res.message,
      });
      await loadAccounts();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: 'Could not sync Chart of Accounts from Cin7.',
      });
    } finally {
      setSyncing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Journal Entry actions
  // ---------------------------------------------------------------------------

  const handlePostEntry = async (id: string) => {
    setPostingId(id);
    try {
      await postJournalEntry(id);
      toast({ title: 'Journal Posted', description: 'Journal entry has been posted.' });
      await loadJournals();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not post journal entry.';
      toast({ variant: 'destructive', title: 'Post Failed', description: message });
    } finally {
      setPostingId(null);
    }
  };

  const addDraftLine = () => {
    setDraftLines((prev) => [
      ...prev,
      {
        key: Date.now(),
        account_id: '',
        line_type: 'debit',
        amount: '',
        description: '',
      },
    ]);
  };

  const removeDraftLine = (key: number) => {
    setDraftLines((prev) => prev.filter((l) => l.key !== key));
  };

  const updateDraftLine = (key: number, field: keyof DraftLine, value: string) => {
    setDraftLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const handleCreateJournal = async () => {
    if (!journalDate) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Journal date is required.',
      });
      return;
    }
    if (draftLines.some((l) => !l.account_id || !l.amount)) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'All lines need an account and amount.',
      });
      return;
    }

    const lines: JournalLineCreateRequest[] = draftLines.map((l) => ({
      account_id: l.account_id,
      line_type: l.line_type,
      amount: parseFloat(l.amount),
      description: l.description || undefined,
    }));

    setCreatingJournal(true);
    try {
      await createJournalEntry({
        journal_date: journalDate,
        reference: journalReference || undefined,
        description: journalDescription || undefined,
        lines,
      });
      toast({ title: 'Journal Created', description: 'Draft journal entry created successfully.' });
      setNewJournalOpen(false);
      setJournalDate('');
      setJournalReference('');
      setJournalDescription('');
      setDraftLines([
        { key: 0, account_id: '', line_type: 'debit', amount: '', description: '' },
        { key: 1, account_id: '', line_type: 'credit', amount: '', description: '' },
      ]);
      await loadJournals();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not create journal entry.';
      toast({ variant: 'destructive', title: 'Create Failed', description: message });
    } finally {
      setCreatingJournal(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Account Mapping actions
  // ---------------------------------------------------------------------------

  const openEditMapping = (mapping: Cin7AccountMapping) => {
    setEditMapping(mapping);
    setEditAccountCode(mapping.account_code ?? '');
  };

  const handleSaveMapping = async () => {
    if (!editMapping) return;
    setSavingMapping(true);
    try {
      await upsertAccountMapping({
        erp_entity_type: editMapping.erp_entity_type as ErpEntityType,
        erp_field: editMapping.erp_field,
        account_code: editAccountCode || undefined,
        cin7_account_id: editMapping.cin7_account_id ?? undefined,
        is_default: editMapping.is_default,
      });
      toast({ title: 'Mapping Saved', description: 'Account mapping updated.' });
      setEditMapping(null);
      await loadMappings();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Could not save mapping.',
      });
    } finally {
      setSavingMapping(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/settings/integrations"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Integrations
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
              <BookOpen className="text-primary h-4 w-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Financial / GL Integration</h1>
              <p className="text-muted-foreground text-xs">
                Chart of Accounts, journal entries and account mappings synced from Cin7
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chart-of-accounts">
        <TabsList>
          <TabsTrigger value="chart-of-accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="journal-entries">Journal Entries</TabsTrigger>
          <TabsTrigger value="account-mappings">Account Mappings</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ */}
        {/* Tab 1: Chart of Accounts                                            */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="chart-of-accounts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Chart of Accounts</CardTitle>
                <CardDescription>
                  GL accounts synced from Cin7. Used to map ERP transactions to the correct ledger.
                </CardDescription>
              </div>
              <Button onClick={handleSync} disabled={syncing} size="sm">
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync from Cin7
              </Button>
            </CardHeader>
            <CardContent>
              {accountsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No accounts found. Click &quot;Sync from Cin7&quot; to import your Chart of
                  Accounts.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Synced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((acc) => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-mono text-sm font-medium">
                          {acc.account_code}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{acc.account_name}</p>
                            {acc.description && (
                              <p className="text-muted-foreground text-xs">{acc.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${accountTypeBadge(acc.account_type)}`}
                          >
                            {acc.account_type.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{acc.currency}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              acc.is_active
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {acc.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {acc.last_synced_at
                            ? new Date(acc.last_synced_at).toLocaleDateString('en-AU')
                            : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Tab 2: Journal Entries                                               */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="journal-entries" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle>Journal Entries</CardTitle>
                <CardDescription>
                  Double-entry GL journals from orders, invoices, payments and manual entries.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => setNewJournalOpen(true)}>
                  <FilePlus className="mr-2 h-4 w-4" />
                  New Journal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {journalsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
              ) : journals.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No journal entries found.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journals.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell className="text-sm">
                          {new Date(j.journal_date).toLocaleDateString('en-AU')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{j.reference ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground max-w-48 truncate text-sm">
                          {j.description ?? '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ${parseFloat(j.total_debit).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ${parseFloat(j.total_credit).toFixed(2)}
                        </TableCell>
                        <TableCell>{sourceBadge(j.source)}</TableCell>
                        <TableCell>{journalStatusBadge(j.status)}</TableCell>
                        <TableCell>
                          {j.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={postingId === j.id}
                              onClick={() => handlePostEntry(j.id)}
                            >
                              {postingId === j.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Post'
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Tab 3: Account Mappings                                              */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="account-mappings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Account Mappings</CardTitle>
              <CardDescription>
                Define which GL account to use for each ERP entity type and field.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
              ) : mappings.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No mappings configured.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ERP Entity Type</TableHead>
                      <TableHead>ERP Field</TableHead>
                      <TableHead>Account Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {m.erp_entity_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{m.erp_field}</TableCell>
                        <TableCell className="font-mono text-sm">{m.account_code ?? '—'}</TableCell>
                        <TableCell className="text-sm">{m.account_name ?? '—'}</TableCell>
                        <TableCell>
                          {m.is_default ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Default
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openEditMapping(m)}>
                            Edit Mapping
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* -------------------------------------------------------------------- */}
      {/* New Journal Dialog                                                     */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={newJournalOpen} onOpenChange={setNewJournalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
            <DialogDescription>
              Create a manual double-entry journal. Debits and credits do not need to balance now —
              balancing is validated when you Post the entry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="journal-date">Journal Date *</Label>
                <Input
                  id="journal-date"
                  type="date"
                  value={journalDate}
                  onChange={(e) => setJournalDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="journal-reference">Reference</Label>
                <Input
                  id="journal-reference"
                  placeholder="e.g. ORD-2026-042"
                  value={journalReference}
                  onChange={(e) => setJournalReference(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-description">Description</Label>
              <Input
                id="journal-description"
                placeholder="Brief description of this journal"
                value={journalDescription}
                onChange={(e) => setJournalDescription(e.target.value)}
              />
            </div>

            <Separator />

            {/* Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lines</Label>
                <Button type="button" size="sm" variant="outline" onClick={addDraftLine}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-2">
                {draftLines.map((line) => (
                  <div key={line.key} className="grid grid-cols-12 items-center gap-2">
                    {/* Account selector */}
                    <div className="col-span-4">
                      <Select
                        value={line.account_id}
                        onValueChange={(v) => updateDraftLine(line.key, 'account_id', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.account_code} — {a.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Debit / Credit */}
                    <div className="col-span-2">
                      <Select
                        value={line.line_type}
                        onValueChange={(v) => updateDraftLine(line.key, 'line_type', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Amount */}
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={line.amount}
                        onChange={(e) => updateDraftLine(line.key, 'amount', e.target.value)}
                      />
                    </div>

                    {/* Description */}
                    <div className="col-span-3">
                      <Input
                        placeholder="Line description"
                        value={line.description}
                        onChange={(e) => updateDraftLine(line.key, 'description', e.target.value)}
                      />
                    </div>

                    {/* Remove */}
                    <div className="col-span-1 flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDraftLine(line.key)}
                        disabled={draftLines.length <= 2}
                      >
                        <Trash2 className="text-destructive h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Running totals */}
              <div className="text-muted-foreground flex justify-end gap-6 pt-2 text-sm">
                <span>
                  Debits:{' '}
                  <span className="text-foreground font-mono font-medium">
                    $
                    {draftLines
                      .filter((l) => l.line_type === 'debit')
                      .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
                      .toFixed(2)}
                  </span>
                </span>
                <span>
                  Credits:{' '}
                  <span className="text-foreground font-mono font-medium">
                    $
                    {draftLines
                      .filter((l) => l.line_type === 'credit')
                      .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
                      .toFixed(2)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewJournalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateJournal} disabled={creatingJournal}>
              {creatingJournal ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FilePlus className="mr-2 h-4 w-4" />
              )}
              Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* Edit Mapping Dialog                                                    */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={!!editMapping} onOpenChange={(open) => !open && setEditMapping(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account Mapping</DialogTitle>
            <DialogDescription>
              Update the GL account code for this ERP mapping rule.
            </DialogDescription>
          </DialogHeader>

          {editMapping && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">ERP Entity Type</Label>
                  <p className="mt-1 font-medium capitalize">{editMapping.erp_entity_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">ERP Field</Label>
                  <p className="mt-1 font-mono font-medium">{editMapping.erp_field}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-account-code">Account Code</Label>
                <Input
                  id="edit-account-code"
                  placeholder="e.g. 4000"
                  value={editAccountCode}
                  onChange={(e) => setEditAccountCode(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMapping(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMapping} disabled={savingMapping}>
              {savingMapping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
