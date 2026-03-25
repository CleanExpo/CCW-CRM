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
import { apiClient } from '@/lib/api/client';
import {
  RefreshCw,
  Banknote,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type {
  BankFeedEntry,
  BankAccount,
  ReconciliationStats,
  ReconciliationAlert,
} from '@/lib/api/bank-feeds';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export default function BankFeedsPage() {
  const { toast } = useToast();
  const [feeds, setFeeds] = useState<BankFeedEntry[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [stats, setStats] = useState<ReconciliationStats | null>(null);
  const [alerts, setAlerts] = useState<ReconciliationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const accountId = selectedAccountId !== 'all' ? selectedAccountId : undefined;

      const [feedsData, accountsData, statsData, alertsData] = await Promise.all([
        apiClient
          .get<
            BankFeedEntry[]
          >(`/api/bank-feeds/unreconciled${accountId ? `?account_id=${accountId}` : ''}`)
          .catch(() => [] as BankFeedEntry[]),
        apiClient.get<BankAccount[]>('/api/bank-feeds/accounts').catch(() => [] as BankAccount[]),
        apiClient
          .get<ReconciliationStats>(
            `/api/bank-feeds/stats${accountId ? `?account_id=${accountId}` : ''}`
          )
          .catch(() => null),
        apiClient
          .get<
            ReconciliationAlert[]
          >(`/api/bank-feeds/alerts${accountId ? `?account_id=${accountId}` : ''}`)
          .catch(() => [] as ReconciliationAlert[]),
      ]);

      setFeeds(feedsData);
      setAccounts(accountsData);
      setStats(statsData);
      setAlerts(alertsData);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load bank feed data';
      toast({ variant: 'destructive', title: 'Error', description: message });
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const payload: Record<string, string | null> = {
        account_id: selectedAccountId !== 'all' ? selectedAccountId : null,
        start_date: null,
        end_date: null,
      };
      const result = await apiClient.post<{
        transactions_synced: number;
        provider: string;
      }>('/api/bank-feeds/sync', payload);
      toast({
        title: 'Sync Complete',
        description: `Synced ${result.transactions_synced} transactions from ${result.provider}`,
      });
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      toast({ variant: 'destructive', title: 'Sync Failed', description: message });
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const getSeverityVariant = (
    severity: string
  ): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (severity === 'critical') return 'destructive';
    if (severity === 'warning') return 'outline';
    return 'secondary';
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bank Feeds</h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Reconciliation overview and unmatched transaction review
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.account_name} (••••{acc.account_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSync} disabled={syncing} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Feeds'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Banknote className="text-muted-foreground h-8 w-8" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total_transactions}</p>
                    <p className="text-muted-foreground text-sm">Total Transactions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {stats.reconciliation_rate}%
                    </p>
                    <p className="text-muted-foreground text-sm">Reconciled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.auto_matched}</p>
                    <p className="text-muted-foreground text-sm">Auto Matched</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <TrendingDown className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{stats.unmatched}</p>
                    <p className="text-muted-foreground text-sm">Unmatched</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-5 w-5" />
                Reconciliation Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="bg-background flex items-start gap-3 rounded-md border p-3"
                  >
                    <Badge variant={getSeverityVariant(alert.severity)} className="mt-0.5 shrink-0">
                      {alert.severity}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-sm">{alert.description}</p>
                      {alert.affected_count > 0 && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {alert.affected_count} transaction{alert.affected_count !== 1 ? 's' : ''}
                          {alert.total_amount > 0 ? ` · ${formatCurrency(alert.total_amount)}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bank Accounts */}
        {accounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Connected Bank Accounts</CardTitle>
              <CardDescription>{accounts.length} active accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-4 py-3 text-left font-medium">Account Name</th>
                      <th className="px-4 py-3 text-left font-medium">Bank</th>
                      <th className="px-4 py-3 text-left font-medium">Account No.</th>
                      <th className="px-4 py-3 text-left font-medium">Provider</th>
                      <th className="px-4 py-3 text-left font-medium">Location</th>
                      <th className="px-4 py-3 text-left font-medium">Last Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id} className="hover:bg-muted/30 border-b transition-colors">
                        <td className="px-4 py-3 font-medium">{account.account_name}</td>
                        <td className="text-muted-foreground px-4 py-3">{account.bank_name}</td>
                        <td className="px-4 py-3 font-mono text-sm">
                          ••••{account.account_number}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{account.feed_provider || 'manual'}</Badge>
                        </td>
                        <td className="text-muted-foreground px-4 py-3">
                          {account.location_code || '—'}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-xs">
                          {account.last_feed_sync_at
                            ? formatDate(account.last_feed_sync_at)
                            : 'Never synced'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unreconciled Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Unreconciled Transactions</CardTitle>
            <CardDescription>Transactions pending manual review and matching</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : feeds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
                <p className="text-muted-foreground text-lg font-medium">
                  All transactions reconciled
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  No unmatched transactions found for the selected account.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Description</th>
                      <th className="px-4 py-3 text-left font-medium">Reference</th>
                      <th className="px-4 py-3 text-right font-medium">Credit</th>
                      <th className="px-4 py-3 text-right font-medium">Debit</th>
                      <th className="px-4 py-3 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeds.map((feed) => (
                      <tr key={feed.id} className="hover:bg-muted/30 border-b transition-colors">
                        <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                          {formatDate(feed.transaction_date)}
                        </td>
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate">{feed.description}</p>
                        </td>
                        <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                          {feed.reference || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-green-600">
                          {feed.credit !== null ? formatCurrency(feed.credit) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-red-600">
                          {feed.debit !== null ? formatCurrency(feed.debit) : '—'}
                        </td>
                        <td className="text-muted-foreground px-4 py-3 text-right font-mono">
                          {feed.balance !== null ? formatCurrency(feed.balance) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
