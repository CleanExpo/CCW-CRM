'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Building2,
  ArrowRight,
  Download,
  Plus,
  Edit,
  Trash2,
  Scale,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { FilterPanel, type ReconciliationFilters } from './components/FilterPanel';
import { BulkActionsPanel } from './components/BulkActionsPanel';
import { ExportDialog } from './components/ExportDialog';
import { BankAccountDialog } from './components/BankAccountDialog';
import {
  OperationsPageHeader,
  OperationsPageLayout,
} from '@/components/operations/OperationsPageHeader';
import { opCardClass, opHeroSurfaceClass, reconciliationAlertTone } from '@/lib/operations/ui';
import { cn } from '@/lib/utils';

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bsb: string;
  bank_name: string;
  account_type: 'checking' | 'savings' | 'credit';
  feed_provider: 'xero' | 'yodlee' | 'basiq' | 'manual';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  location_code?: string;
  last_feed_sync_at?: string | null;
}

interface BankFeed {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference: string;
  credit: number | null;
  debit: number | null;
  balance: number | null;
}

interface POSTransaction {
  id: string;
  transaction_number: string;
  amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  location_code: string;
}

interface ReconciliationAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affected_count: number;
  total_amount: number;
}

export default function ReconciliationPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [unreconciledFeeds, setUnreconciledFeeds] = useState<BankFeed[]>([]);
  const [unreconciledPOS, setUnreconciledPOS] = useState<POSTransaction[]>([]);
  const [alerts, setAlerts] = useState<ReconciliationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creatingInvoices, setCreatingInvoices] = useState(false);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<BankFeed | null>(null);
  const [selectedPOS, setSelectedPOS] = useState<POSTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<ReconciliationFilters>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isBankAccountDialogOpen, setIsBankAccountDialogOpen] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  // Load bank accounts
  const loadAccounts = useCallback(async () => {
    try {
      const data = await apiClient.get<BankAccount[]>('/api/bank-feeds/accounts');
      setAccounts(data);
      if (data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  }, [selectedAccount]);

  // Load alerts
  const loadAlerts = useCallback(async () => {
    try {
      const alertsData = await apiClient.get<ReconciliationAlert[]>('/api/bank-feeds/alerts');
      setAlerts(alertsData);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  }, []);

  // Load unreconciled data
  const loadUnreconciledData = useCallback(async () => {
    if (!selectedAccount) return;

    setLoading(true);
    try {
      const [feeds, transactions] = await Promise.all([
        apiClient.get<BankFeed[]>(`/api/bank-feeds/unreconciled?account_id=${selectedAccount}`),
        apiClient.get<{ items: POSTransaction[] }>(
          `/api/pos/transactions?reconciliation_status=pending&page_size=100`
        ),
      ]);

      setUnreconciledFeeds(feeds);
      setUnreconciledPOS(transactions.items || []);

      // Load alerts
      await loadAlerts();
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load reconciliation data',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, toast, loadAlerts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (selectedAccount) {
      loadUnreconciledData();
    }
  }, [selectedAccount, loadUnreconciledData]);

  // Sync bank feeds
  const handleSync = async () => {
    if (!selectedAccount) return;

    setSyncing(true);
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      await apiClient.post('/api/bank-feeds/sync', {
        account_id: selectedAccount,
        start_date: thirtyDaysAgo.toISOString().split('T')[0],
        end_date: today.toISOString().split('T')[0],
      });

      toast({
        title: 'Sync Complete',
        description: 'Bank feeds have been synchronized',
      });

      await loadUnreconciledData();
    } catch (error) {
      console.error('Sync failed:', error);
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: 'Failed to sync bank feeds',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Bulk create Xero invoices
  const handleBulkCreateInvoices = async () => {
    setCreatingInvoices(true);
    try {
      const result = await apiClient.post<{
        total: number;
        created: number;
        failed: number;
      }>('/api/pos/xero/bulk-invoices');

      toast({
        title: 'Invoices Created',
        description: `Created ${result.created} invoices. ${result.failed > 0 ? `${result.failed} failed.` : ''}`,
      });

      await loadUnreconciledData();
    } catch (error) {
      console.error('Bulk invoice creation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Failed',
        description: 'Failed to create Xero invoices',
      });
    } finally {
      setCreatingInvoices(false);
    }
  };

  // Open match dialog
  const handleMatchClick = (feed: BankFeed) => {
    setSelectedFeed(feed);
    setSelectedPOS(null);
    setMatchDialogOpen(true);
  };

  // Confirm reconciliation
  const handleConfirmMatch = async () => {
    if (!selectedFeed || !selectedPOS) return;

    try {
      await apiClient.post('/api/bank-feeds/reconcile', {
        feed_id: selectedFeed.id,
        pos_transaction_id: selectedPOS.id,
      });

      toast({
        title: 'Reconciled',
        description: `Matched ${selectedFeed.reference} to ${selectedPOS.transaction_number}`,
      });

      setMatchDialogOpen(false);
      await loadUnreconciledData();
    } catch (error: unknown) {
      toast({
        variant: 'destructive',
        title: 'Match Failed',
        description: error instanceof Error ? error.message : 'Failed to reconcile transactions',
      });
    }
  };

  // Filter POS transactions for matching
  const filteredPOS = unreconciledPOS.filter((t) => {
    if (!searchTerm) return true;
    return (
      t.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.amount.toString().includes(searchTerm)
    );
  });

  // Find potential matches based on amount
  const findPotentialMatches = (feed: BankFeed) => {
    const feedAmount = feed.credit || 0;
    return unreconciledPOS.filter((t) => Math.abs(t.amount - feedAmount) < 0.11);
  };

  const selectedAccountData = accounts.find((a) => a.id === selectedAccount);
  const allVisibleSelected =
    unreconciledFeeds.length > 0 &&
    unreconciledFeeds.every((feed) => selectedItems.has(feed.id));

  return (
    <OperationsPageLayout className="space-y-6">
      <OperationsPageHeader
        accent="mint"
        title="Reconciliation"
        description="Match bank feed lines to POS card settlements. Sync pulls recent activity; use export for your finance workflow."
        icon={Scale}
        breadcrumbs={[
          { label: 'POS', href: '/dashboard/operations/pos' },
          { label: 'Reconciliation' },
        ]}
        actions={
          <>
            <Button onClick={() => setIsExportDialogOpen(true)} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={handleBulkCreateInvoices} disabled={creatingInvoices} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${creatingInvoices ? 'animate-spin' : ''}`} />
              {creatingInvoices ? 'Creating…' : 'Create Xero invoices'}
            </Button>
            <Button onClick={handleSync} disabled={syncing || !selectedAccount}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync bank feeds'}
            </Button>
          </>
        }
      />

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert, index) => {
            const tone = reconciliationAlertTone(alert.severity);
            const severityIcons = {
              info: <CheckCircle2 className={cn('h-5 w-5', tone.iconWrap)} />,
              warning: <AlertTriangle className={cn('h-5 w-5', tone.iconWrap)} />,
              critical: <AlertTriangle className={cn('h-5 w-5', tone.iconWrap)} />,
            };

            return (
              <Card
                key={index}
                className={cn('border-l-4 border-l-current shadow-sm', tone.card)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{severityIcons[alert.severity]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-foreground font-semibold">{alert.title}</h3>
                        <Badge
                          variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                          className="text-xs uppercase"
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm leading-relaxed dark:text-foreground/80">
                        {alert.description}
                      </p>
                      {alert.affected_count > 0 && (
                        <p className="text-muted-foreground mt-2 text-xs dark:text-foreground/65">
                          Affected: {alert.affected_count} transaction
                          {alert.affected_count !== 1 ? 's' : ''}
                          {alert.total_amount > 0 &&
                            ` · Total ${formatCurrency(alert.total_amount)}`}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className={cn(opCardClass, opHeroSurfaceClass)}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 shrink-0" />
            Bank account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.account_name} (****{account.account_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccountData && (
              <div className="text-muted-foreground text-sm">
                <span className="font-medium">{selectedAccountData.bank_name}</span>
                {selectedAccountData.last_feed_sync_at && (
                  <span className="ml-4">
                    Last sync: {format(new Date(selectedAccountData.last_feed_sync_at), 'PP p')}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <FilterPanel
        filters={filters}
        onFilterChange={setFilters}
        bankAccounts={accounts.map((a) => ({ id: a.id, account_name: a.account_name }))}
      />

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <BulkActionsPanel
          selectedItems={selectedItems}
          onClearSelection={() => setSelectedItems(new Set())}
          onSuccess={() => {
            loadAccounts();
            loadAlerts();
            loadUnreconciledData();
          }}
          bankFeedData={unreconciledFeeds.map((f) => ({
            id: f.id,
            amount: f.credit || -(f.debit ?? 0) || 0,
          }))}
          posTransactionData={unreconciledPOS.map((t) => ({ id: t.id, amount: t.amount }))}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className={cn(opCardClass, opHeroSurfaceClass)}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-amber-500/15 p-3 ring-1 ring-amber-500/25">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-foreground text-2xl font-bold tabular-nums">
                  {unreconciledFeeds.length}
                </div>
                <div className="text-muted-foreground text-sm dark:text-foreground/70">
                  Unreconciled bank lines
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(opCardClass, opHeroSurfaceClass)}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-sky-500/15 p-3 ring-1 ring-sky-500/25">
                <Link2 className="h-6 w-6 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <div className="text-foreground text-2xl font-bold tabular-nums">
                  {unreconciledPOS.length}
                </div>
                <div className="text-muted-foreground text-sm dark:text-foreground/70">
                  Unmatched POS transactions
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(opCardClass, opHeroSurfaceClass)}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-emerald-500/15 p-3 ring-1 ring-emerald-500/25">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-foreground text-2xl font-bold tabular-nums">
                  {unreconciledFeeds.filter((f) => findPotentialMatches(f).length > 0).length}
                </div>
                <div className="text-muted-foreground text-sm dark:text-foreground/70">
                  Suggested matches (by amount)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unreconciled Bank Transactions */}
      <Card className={cn(opCardClass, opHeroSurfaceClass)}>
        <CardHeader>
          <CardTitle>Unreconciled bank transactions</CardTitle>
          <CardDescription className="dark:text-foreground/70">
            Choose Match to link a deposit line to a POS settlement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : unreconciledFeeds.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 opacity-20" />
              <p>All bank transactions are reconciled</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => {
                        const next = new Set(selectedItems);
                        if (event.target.checked) {
                          unreconciledFeeds.forEach((feed) => next.add(feed.id));
                        } else {
                          unreconciledFeeds.forEach((feed) => next.delete(feed.id));
                        }
                        setSelectedItems(next);
                      }}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unreconciledFeeds.map((feed) => {
                  const matches = findPotentialMatches(feed);
                  return (
                    <TableRow key={feed.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedItems.has(feed.id)}
                          onChange={(event) => {
                            const next = new Set(selectedItems);
                            if (event.target.checked) {
                              next.add(feed.id);
                            } else {
                              next.delete(feed.id);
                            }
                            setSelectedItems(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>{format(new Date(feed.transaction_date), 'PP')}</TableCell>
                      <TableCell className="font-mono text-sm">{feed.reference || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{feed.description}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(feed.credit)}
                      </TableCell>
                      <TableCell>
                        {matches.length > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/35 bg-emerald-500/15 font-medium text-emerald-900 dark:text-emerald-100"
                          >
                            {matches.length} match{matches.length > 1 ? 'es' : ''}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="font-normal">
                            No matches
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleMatchClick(feed)}>
                          <Link2 className="mr-1 h-4 w-4" />
                          Match
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Match Dialog */}
      <Dialog open={matchDialogOpen} onOpenChange={setMatchDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Match Bank Transaction</DialogTitle>
            <DialogDescription>
              Select a POS transaction to match with this bank feed
            </DialogDescription>
          </DialogHeader>

          {selectedFeed && (
            <div className="space-y-4">
              {/* Bank Transaction Info */}
              <Card className={cn(opCardClass, opHeroSurfaceClass, 'bg-muted/30')}>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Reference:</span>{' '}
                      <span className="font-medium">{selectedFeed.reference}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{' '}
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(selectedFeed.credit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>{' '}
                      <span className="font-medium">
                        {format(new Date(selectedFeed.transaction_date), 'PP')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Description:</span>{' '}
                      <span className="font-medium">{selectedFeed.description}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-center">
                <ArrowRight className="text-muted-foreground h-6 w-6" />
              </div>

              {/* POS Transaction Search */}
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by transaction number or amount..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* POS Transactions List */}
              <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Transaction</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPOS.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center">
                          No matching transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPOS.map((t) => {
                        const isMatch =
                          selectedFeed.credit && Math.abs(t.amount - selectedFeed.credit) < 0.11;
                        return (
                          <TableRow
                            key={t.id}
                            className={`cursor-pointer ${
                              selectedPOS?.id === t.id ? 'bg-primary/10' : ''
                            } ${isMatch ? 'bg-emerald-500/10 dark:bg-emerald-500/15' : ''}`}
                            onClick={() => setSelectedPOS(t)}
                          >
                            <TableCell>
                              <input
                                type="radio"
                                checked={selectedPOS?.id === t.id}
                                onChange={() => setSelectedPOS(t)}
                                className="h-4 w-4"
                              />
                            </TableCell>
                            <TableCell className="font-mono">
                              {t.transaction_number}
                              {isMatch && (
                                <Badge
                                  className="ml-2 border-emerald-600/30 bg-emerald-600 text-white dark:bg-emerald-600"
                                  variant="default"
                                >
                                  Match
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(t.created_at), 'PP')}</TableCell>
                            <TableCell className="uppercase">{t.payment_method}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(t.amount)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmMatch} disabled={!selectedPOS}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        bankAccountId={selectedAccount}
      />

      {/* Bank Account Dialog */}
      <BankAccountDialog
        open={isBankAccountDialogOpen}
        onOpenChange={setIsBankAccountDialogOpen}
        mode={editingBankAccount ? 'edit' : 'create'}
        account={editingBankAccount || undefined}
        onSuccess={() => {
          loadAccounts();
          loadAlerts();
          loadUnreconciledData();
        }}
      />
    </OperationsPageLayout>
  );
}
